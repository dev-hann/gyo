import * as path from 'path';
import { MultiPlatformCommand, CommandMeta, MultiPlatformCommandOptions } from './base/index';
import { logger } from '../utils/logger';
import { executeCommand, getGradlew } from '../utils/exec';
import { pathExists, removeDir } from '../utils/fs';
import { GyoError } from '../core/index';

export class CleanCommand extends MultiPlatformCommand<MultiPlatformCommandOptions> {
  getMeta(): CommandMeta {
    return {
      name: 'clean',
      arguments: '[platform]',
      description: 'Clean build artifacts (android, ios, lib, or all)',
    };
  }

  protected getValidPlatforms(): string[] {
    return ['android', 'ios', 'lib', 'all'];
  }

  protected async run(): Promise<void> {
    this.startSpinner('Cleaning build artifacts...');

    try {
      await this.processAllPlatforms((p) => this.cleanPlatform(p));
      this.succeedSpinner('Clean complete!');
    } catch (error) {
      if (error instanceof GyoError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.failSpinner(`Clean failed: ${message}`);
      throw new GyoError(message);
    }
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

  private async cleanAndroid(): Promise<void> {
    const androidPath = path.join(this.projectPath, 'android');

    if (!(await pathExists(androidPath))) {
      logger.warn('Android project not found, skipping');
      return;
    }

    this.updateSpinner('Cleaning Android build...');

    const gradlew = getGradlew();
    const cleanResult = await executeCommand(gradlew, ['clean'], {
      cwd: androidPath,
      stdio: 'pipe',
    });

    if (!cleanResult.success) {
      logger.warn('Android clean failed');
      logger.error(cleanResult.stderr);
    } else {
      logger.success('Android build cleaned');
    }

    const buildPath = path.join(androidPath, 'app/build');
    if (await pathExists(buildPath)) {
      await removeDir(buildPath);
    }
  }

  private async cleanIOS(): Promise<void> {
    const iosPath = path.join(this.projectPath, 'ios');

    if (!(await pathExists(iosPath))) {
      logger.warn('iOS project not found, skipping');
      return;
    }

    this.updateSpinner('Cleaning iOS build...');

    const cleanupTasks: Promise<void>[] = [];

    const buildPath = path.join(iosPath, 'build');
    if (await pathExists(buildPath)) {
      cleanupTasks.push(removeDir(buildPath).then(() => logger.success('iOS build cleaned')));
    }

    const podsPath = path.join(iosPath, 'Pods');
    if (await pathExists(podsPath)) {
      cleanupTasks.push(removeDir(podsPath).then(() => logger.success('iOS Pods cleaned')));
    }

    await Promise.all(cleanupTasks);
  }

  private async cleanLib(): Promise<void> {
    const libPath = path.join(this.projectPath, 'lib');

    if (!(await pathExists(libPath))) {
      logger.warn('Lib project not found, skipping');
      return;
    }

    this.updateSpinner('Cleaning lib build...');

    const cleanupTasks: Promise<void>[] = [];

    const distPath = path.join(libPath, 'dist');
    if (await pathExists(distPath)) {
      cleanupTasks.push(removeDir(distPath));
    }

    const nodeModulesPath = path.join(libPath, 'node_modules');
    if (await pathExists(nodeModulesPath)) {
      cleanupTasks.push(removeDir(nodeModulesPath));
    }

    await Promise.all(cleanupTasks);
    logger.success('Lib build cleaned');
  }
}
