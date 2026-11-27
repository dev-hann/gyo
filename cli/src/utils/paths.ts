import * as path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { GyoError } from '../core/errors';

/**
 * A file shipped with the CLI, looked up next to the bundle and, when the
 * CLI runs unbundled, above the sources.
 */
function cliFile(...segments: string[]): string {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = ['..', '../..', '../../..'].map((up) => path.resolve(dir, up, ...segments));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new GyoError(`${segments.join('/')} not found next to the CLI. Reinstall gyo CLI.`);
}

export function getTemplatesPath(): string {
  return cliFile('templates');
}

/** The version of the installed CLI. */
export function getCliVersion(): string {
  return (fs.readJsonSync(cliFile('package.json')) as { version: string }).version;
}
