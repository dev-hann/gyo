import * as path from 'path';
import type { CommandMeta, MultiPlatformCommandOptions } from './base/index';
import { MultiPlatformCommand } from './base/index';
import { logger } from '../utils/logger';
import { executeCommand, getGradlew } from '../utils/exec';
import { pathExists, removeDir } from '../utils/fs';
import { GyoError, getErrorMessage } from '../core/index';

export class CleanCommand extends MultiPlatformCommand<MultiPlatformCommandOptions> {
  /** What could not be removed; fails the command once every platform was tried. */
  private readonly failures: { path: string; error?: unknown }[] = [];

  getMeta(): CommandMeta {
    return {
      name: 'clean',
      arguments: '[platform]',
      description: 'Clean build artifacts (android, ios, lib, or all)',
      positionalHandler: 'platformWithAll',
    };
  }

  protected getValidPlatforms(): string[] {
    return ['android', 'ios', 'lib', 'all'];
  }

  protected async run(): Promise<void> {
    this.startSpinner('Cleaning build artifacts...');
    const platforms = this.getPlatformsToProcess();

    await Promise.all(platforms.map((platform) => this.cleanPlatform(platform)));

    if (this.failures.length > 0) {
      throw new GyoError(`Could not clean: ${this.failures.map((f) => f.path).join(', ')}`, 1, {
        cause: this.failures[0].error,
      });
    }
    this.succeedSpinner('Clean complete!');
  }

  private async cleanPlatform(platform: string): Promise<void> {
    switch (platform) {
      case 'android':
        await this.cleanAndroid();
        break;
      case 'ios':
        await this.cleanIOS();
        break;
      case 'lib':
        await this.cleanLib();
        break;
    }
  }

  /** Removes a directory, or remembers it when that fails. */
  private async removeDir(dirPath: string, label: string): Promise<void> {
    if (!(await pathExists(dirPath))) {
      return;
    }
    try {
      await removeDir(dirPath);
      logger.success(`${label} cleaned`);
    } catch (error) {
      logger.warn(`Failed to remove ${dirPath}: ${getErrorMessage(error)}`);
      this.failures.push({ path: dirPath, error });
    }
  }

  private async cleanAndroid(): Promise<void> {
    const androidPath = path.join(this.projectPath, 'android');

    if (!(await pathExists(androidPath))) {
      logger.warn('Android project not found, skipping');
      return;
    }

    this.updateSpinner('Cleaning Android build...');

    const gradleResult = await executeCommand(getGradlew(), ['clean'], {
      cwd: androidPath,
      stdio: 'pipe',
    });
    if (gradleResult.success) {
      logger.success('Android build cleaned');
    } else {
      logger.warn('Android clean failed');
      logger.error(gradleResult.stderr);
      this.failures.push({ path: `${androidPath} (gradle clean)` });
    }

    await this.removeDir(path.join(androidPath, 'app/build'), 'Android app/build');
  }

  private async cleanIOS(): Promise<void> {
    const iosPath = path.join(this.projectPath, 'ios');

    if (!(await pathExists(iosPath))) {
      logger.warn('iOS project not found, skipping');
      return;
    }

    this.updateSpinner('Cleaning iOS build...');
    // xtool builds through SwiftPM, which keeps everything in .build.
    await this.removeDir(path.join(iosPath, '.build'), 'iOS .build');
  }

  private async cleanLib(): Promise<void> {
    const libPath = path.join(this.projectPath, 'lib');

    if (!(await pathExists(libPath))) {
      logger.warn('Lib project not found, skipping');
      return;
    }

    this.updateSpinner('Cleaning lib build...');
    await this.removeDir(path.join(libPath, 'dist'), 'Lib dist');

    const nodeModulesPath = path.join(libPath, 'node_modules');
    if (await pathExists(nodeModulesPath)) {
      logger.warn('Removing node_modules/ — you will need to run npm install before next run');
      await this.removeDir(nodeModulesPath, 'Lib node_modules');
    }
  }
}
