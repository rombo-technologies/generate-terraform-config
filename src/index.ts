import {getInput} from '@actions/core';
import {parse} from 'yaml';

import {generateFiles} from './generator';

async function run() {
  const templateLocation = getInput('templates-location');
  const terraformConfigLocation = getInput('terraform-config-location');
  const context = getInput('context');

  let normalized = {};
  if (context != null && context !== '') {
    normalized = parse(context) as Record<string, string>;
  }

  await generateFiles(templateLocation, terraformConfigLocation, normalized);
}

run();
