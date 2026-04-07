import * as path from 'path';
import { MultiPlatformCommand, CommandMeta, MultiPlatformCommandOptions } from './base/index';
import { logger } from '../utils/logger';
import { executeCommand, getGradlew } from '../utils/exec';
import { pathExists, removeDir } from '../utils/fs';
import { GyoError, getErrorMessage } from '../core/index';

export class CleanCommand extends MultiPlatformCommand<MultiPlatformCommandOptions> {
  private hadWarnings = false;

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
    this.hadWarnings = false;

    try {
      await this.processAllPlatforms((p) => this.cleanPlatform(p));
      if (this.hadWarnings) {
        this.warnSpinner('Clean completed with warnings');
      } else {
        this.succeedSpinner('Clean complete!');
      }
    } catch (error) {
      if (error instanceof GyoError) {
        throw error;
      }
      const message = getErrorMessage(error);
      throw new GyoError(message, 1, { cause: error });
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
      this.hadWarnings = true;
      logger.warn('Android clean failed');
      logger.error(cleanResult.stderr);
    } else {
      logger.success('Android build cleaned');
    }

    const buildPath = path.join(androidPath, 'app/build');
    if (await pathExists(buildPath)) {
      try {
        await removeDir(buildPath);
      } catch (error) {
        this.hadWarnings = true;
        const message = getErrorMessage(error);
        logger.warn(`Failed to remove build directory: ${message}`);
      }
    }
  }

  private async cleanIOS(): Promise<void> {
    const iosPath = path.join(this.projectPath, 'ios');

    if (!(await pathExists(iosPath))) {
      logger.warn('iOS project not found, skipping');
      return;
    }

    this.updateSpinner('Cleaning iOS build...');

    const buildPath = path.join(iosPath, 'build');
    const podsPath = path.join(iosPath, 'Pods');

    const cleanupTasks = [
      { path: buildPath, name: 'build' },
      { path: podsPath, name: 'Pods' },
    ];

    const existingTasks: Array<{ path: string; name: string }> = [];
    for (const task of cleanupTasks) {
      if (await pathExists(task.path)) {
        existingTasks.push(task);
      }
    }

    const results = await Promise.allSettled(
      existingTasks.map(({ path, name }) =>
        removeDir(path)
          .then(() => ({ path, success: true, name }))
          .catch((error) => ({ path, success: false, name, error }))
      )
    );

    this.processCleanupResults(results, 'iOS', 'iOS cleanup failed');
  }

  private processCleanupResults(
    results: PromiseSettledResult<{
      path: string;
      success: boolean;
      name: string;
      error?: unknown;
    }>[],
    platform: string,
    errorMessage: string
  ): void {
    const failures: Array<{ path: string; error: unknown }> = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          logger.success(`${platform} ${result.value.name} cleaned`);
        } else {
          this.hadWarnings = true;
          const value = result.value as {
            path: string;
            success: false;
            name: string;
            error: unknown;
          };
          const message = getErrorMessage(value.error);
          logger.warn(`Failed to remove ${value.path}: ${message}`);
          failures.push({ path: value.path, error: value.error });
        }
      }
    }

    if (failures.length > 0) {
      throw new GyoError(`${errorMessage}: ${failures.map((f) => f.path).join(', ')}`, 1, {
        cause: failures[0].error,
      });
    }
  }

  private async cleanLib(): Promise<void> {
    const libPath = path.join(this.projectPath, 'lib');

    if (!(await pathExists(libPath))) {
      logger.warn('Lib project not found, skipping');
      return;
    }

    this.updateSpinner('Cleaning lib build...');

    const distPath = path.join(libPath, 'dist');
    const nodeModulesPath = path.join(libPath, 'node_modules');

    const cleanupTasks: Array<{ path: string; name: string }> = [{ path: distPath, name: 'dist' }];

    if (await pathExists(nodeModulesPath)) {
      logger.warn('Removing node_modules/ — you will need to run npm install before next run');
      cleanupTasks.push({
        path: nodeModulesPath,
        name: 'node_modules',
      });
    }

    const existingTasks: Array<{ path: string; name: string }> = [];
    for (const task of cleanupTasks) {
      if (await pathExists(task.path)) {
        existingTasks.push(task);
      }
    }

    const results = await Promise.allSettled(
      existingTasks.map(({ path, name }) =>
        removeDir(path)
          .then(() => ({ path, success: true, name }))
          .catch((error) => ({ path, success: false, name, error }))
      )
    );

    this.processCleanupResults(results, 'Lib', 'Lib cleanup failed');
  }
}
