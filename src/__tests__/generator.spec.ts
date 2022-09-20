import {mkdir, mkdtemp, readFile, rm, stat} from 'fs/promises';
import {Stats} from 'fs';
import {resolve} from 'path';
import {sync} from 'walkdir';

import {generateFiles} from '../generator';

const tmpTestOutputsLocation = resolve(process.cwd(), 'tmp/__tests__');

const templatesLocation = resolve(__dirname, 'templates');
const expectedOutputLocation = resolve(__dirname, 'generated');
let actualOutputLocation: string;

beforeEach(async () => {
  await mkdir(resolve(tmpTestOutputsLocation, 'generated'), {recursive: true});
  actualOutputLocation = await mkdtemp(
    resolve(tmpTestOutputsLocation, 'generated/terraform-')
  );
});

afterEach(async () => {
  await rm(tmpTestOutputsLocation, {recursive: true, force: true});
});

test('generates terraform config from input templates', async () => {
  await generateFiles(templatesLocation, actualOutputLocation, {env: 'test'});

  for await (const file of toActualFiles(actualOutputLocation)) {
    expect(file.stats).not.toBeNull();
    expect(file).toMatchContents();
  }
});

function toActualFiles(outputLocation: string) {
  const paths = sync(expectedOutputLocation);

  const outputFiles$ = [];
  for (const path of paths) {
    const relativePath = path
      .replace(expectedOutputLocation, '')
      .replace(/^\//, '');
    const output = resolve(outputLocation, relativePath);
    outputFiles$.push(
      stat(output)
        .catch(() => null)
        .then((stats) => ({stats, expectedPath: path, actualPath: output}))
    );
  }
  return outputFiles$;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Matchers<R> {
      toMatchContents(): CustomMatcherResult;
    }
  }
}

expect.extend({
  async toMatchContents(
    this: jest.MatcherContext,
    actual: {stats: Stats | null; expectedPath: string; actualPath: string}
  ) {
    if (actual.stats?.isFile()) {
      const expectedContents = await readFile(actual.expectedPath, {
        encoding: 'utf-8',
      });
      const actualContents = await readFile(actual.actualPath, {
        encoding: 'utf-8',
      });

      const pass = expectedContents === actualContents;

      return {
        pass,
        message() {
          return pass ? 'File contents match' : 'File contents do not match';
        },
      };
    }

    return {
      pass: true,
      message() {
        return 'Actual was not a pointer to a file';
      },
    };
  },
});
