import {copyFile, mkdir, readFile, stat, writeFile} from 'fs/promises';
import {Stats} from 'fs';
import {async} from 'walkdir';
import {debug} from '@actions/core';
import {dirname} from 'path';
import {render} from 'ejs';

function isStats(statsOrNull: Stats | null): statsOrNull is Stats {
  return statsOrNull != null;
}

interface FileMeta {
  path: string;
  stats: Stats | null;
}

async function getFileMeta(path: string): Promise<FileMeta> {
  const meta = await stat(path);
  return {
    stats: meta,
    path,
  };
}

async function ensureDirectoryForFileIsPresent(targetFile: string) {
  const targetDir = dirname(targetFile);
  try {
    await stat(targetDir);
  } catch {
    await mkdir(targetDir, {recursive: true});
  }
}

function isTemplate(path: string) {
  return path.endsWith('__tmpl__');
}

async function writeTemplatedFile(
  targetFile: string,
  templateFile: string,
  context: Record<string, string>
) {
  targetFile = targetFile.replace('__tmpl__', '');
  const templateContents = await readFile(templateFile, {
    encoding: 'utf-8',
  });
  const contents = await render(templateContents, context, {
    async: true,
  });
  await writeFile(targetFile, contents, {encoding: 'utf-8'});
}

export async function generateFiles(
  templatesLocation: string,
  outputLocation: string,
  context: Record<string, string>
) {
  const templates = await async(templatesLocation);

  for (const template of templates) {
    debug('Processing ' + template);

    const descriptor = await getFileMeta(template);

    if (isStats(descriptor.stats) && descriptor.stats.isFile()) {
      const targetFile = descriptor.path.replace(
        templatesLocation,
        outputLocation
      );
      debug(`Determined target path to be ${targetFile}`);
      await ensureDirectoryForFileIsPresent(targetFile);

      if (isTemplate(descriptor.path)) {
        debug(`${template} was a template file, processing`);
        await writeTemplatedFile(targetFile, descriptor.path, context);
      } else {
        debug(`${template} was not a template file, copying`);
        await copyFile(descriptor.path, targetFile);
      }
    } else {
      debug(`Stats for [${template}] could not be found or is not a file`);
    }
  }
}
