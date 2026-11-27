import * as os from 'os';
import * as path from 'path';
import fs from 'fs-extra';
import { CreateCommand } from '../../commands/create';

/**
 * A project as `gyo create` leaves it, in a directory of its own. It is
 * made with the real command and the real templates, so that a test runs
 * against the layout a developer gets: both native shells and the config.
 *
 * The project is the working directory until `remove()`, which is where a
 * command reads its project from. A command is made after the project, for
 * the same reason.
 */
export interface TestProject {
  /** The project directory. */
  path: string;
  file(...segments: string[]): string;
  android(...segments: string[]): string;
  ios(...segments: string[]): string;
  lib(...segments: string[]): string;
  /** gyo.config.json as `gyo create` wrote it, with `config` over it one top-level key at a time. */
  setConfig(config: Record<string, unknown>): Promise<void>;
  /** Gives `lib/` a web app with these npm scripts. `gyo create` leaves the directory empty. */
  setWebApp(scripts: Record<string, string>): void;
  /** Returns to the directory the test started in, and removes the project. */
  remove(): void;
}

export async function createTestProject(name = 'demo-app'): Promise<TestProject> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gyo-project-'));
  const previousCwd = process.cwd();

  try {
    process.chdir(workDir);
    const command = new CreateCommand();
    command.setPositionalArgs([name]);
    command.setOptions({});
    await command.execute();
  } catch (error) {
    process.chdir(previousCwd);
    fs.removeSync(workDir);
    throw error;
  }

  const projectPath = path.join(workDir, name);
  const configPath = path.join(projectPath, 'gyo.config.json');
  process.chdir(projectPath);

  return {
    path: projectPath,
    file: (...segments) => path.join(projectPath, ...segments),
    android: (...segments) => path.join(projectPath, 'android', ...segments),
    ios: (...segments) => path.join(projectPath, 'ios', ...segments),
    lib: (...segments) => path.join(projectPath, 'lib', ...segments),
    setConfig: async (config) => {
      await fs.writeJson(
        configPath,
        { ...(await fs.readJson(configPath)), ...config },
        { spaces: 2 }
      );
    },
    setWebApp: (scripts) => {
      fs.writeJsonSync(
        path.join(projectPath, 'lib', 'package.json'),
        { name, version: '0.0.0', private: true, scripts },
        { spaces: 2 }
      );
    },
    remove: () => {
      process.chdir(previousCwd);
      fs.removeSync(workDir);
    },
  };
}
