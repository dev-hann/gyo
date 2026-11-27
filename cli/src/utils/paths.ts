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

/** The Node release the CLI installs on: the major version `engines.node` names. */
export function getRequiredNodeMajor(): number {
  const { engines } = fs.readJsonSync(cliFile('package.json')) as { engines: { node: string } };
  const major = Number(engines.node.match(/\d+/)?.[0]);
  if (!Number.isInteger(major)) {
    throw new GyoError(`Cannot read the Node version the CLI needs from: ${engines.node}`);
  }
  return major;
}

/** The Android platform a generated project compiles against. */
export function getAndroidCompileSdk(): number {
  const gradle = fs.readFileSync(cliFile('templates', 'android', 'app', 'build.gradle'), 'utf-8');
  const level = Number(gradle.match(/compileSdk\s*=?\s*(\d+)/)?.[1]);
  if (!Number.isInteger(level)) {
    throw new GyoError('Cannot read compileSdk from the Android template.');
  }
  return level;
}
