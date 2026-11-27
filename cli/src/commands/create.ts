import * as path from 'path';
import fs from 'fs-extra';
import type { BaseCommandOptions, CommandMeta } from './base/index';
import { BaseCommand } from './base/index';
import { logger } from '../utils/logger';
import { copyDir, ensureDir, pathExists, readFile, writeFile } from '../utils/fs';
import { getTemplatesPath } from '../utils/paths';
import {
  DirectoryExistsError,
  GyoError,
  getErrorMessage,
  toDefaultPackageName,
} from '../core/index';

interface CreateCommandOptions extends BaseCommandOptions {
  projectName?: string;
  force?: boolean;
}

/** What a template may ask for between double braces. */
type Placeholder = 'PROJECT_NAME' | 'PROJECT_NAME_LOWER' | 'PACKAGE_NAME';

const PLACEHOLDER = /\{\{(PROJECT_NAME|PROJECT_NAME_LOWER|PACKAGE_NAME)\}\}/g;

const PLATFORM_TEMPLATES = ['android', 'ios'] as const;

export class CreateCommand extends BaseCommand<CreateCommandOptions> {
  private name = '';
  private targetPath = '';

  getMeta(): CommandMeta {
    return {
      name: 'create',
      description: 'Create a new gyo project (native shell + config — bring your own web app)',
      arguments: '<project-name>',
      options: [
        {
          flags: '-f, --force',
          description: 'Overwrite existing project directory',
        },
      ],
    };
  }

  setPositionalArgs([projectName]: string[]): void {
    this.options = { ...this.options, projectName };
  }

  protected async run(): Promise<void> {
    this.name = this.options.projectName ?? '';
    this.validateProjectName(this.name);
    this.targetPath = path.join(process.cwd(), this.name);

    this.startSpinner('Creating gyo project...');

    try {
      await this.validateProjectDirectory();
      await ensureDir(this.targetPath);

      for (const platform of PLATFORM_TEMPLATES) {
        await this.copyPlatform(platform);
      }
      await this.writeProjectFiles();

      this.succeedSpinner('Project structure created.');
      logger.suggestNextSteps([
        `cd ${this.name}`,
        'Create your web app in lib/ (any framework)',
        'Set script.start in gyo.config.json',
        'gyo run          # Run on connected device',
      ]);
    } catch (error) {
      if (error instanceof GyoError) {
        throw error;
      }
      throw new GyoError(getErrorMessage(error), 1, { cause: error });
    }
  }

  private validateProjectName(name: string): void {
    if (!name || name.trim() === '') {
      throw new GyoError('Project name cannot be empty');
    }
    if (/[/\\]/.test(name) || name.includes('..')) {
      throw new GyoError('Project name cannot contain path separators or ".."');
    }
    if (!/^[a-z0-9]([a-z0-9\-_]*[a-z0-9])?$/.test(name)) {
      throw new GyoError(
        'Project name must contain only lowercase letters, numbers, hyphens, and underscores'
      );
    }
  }

  private async validateProjectDirectory(): Promise<void> {
    if (!(await pathExists(this.targetPath))) {
      return;
    }
    if (this.options.force) {
      logger.warn(`Removing existing directory: ${this.targetPath}`);
      await fs.remove(this.targetPath);
    } else {
      throw new DirectoryExistsError(path.basename(this.targetPath), this.targetPath);
    }
  }

  private templatePath(...segments: string[]): string {
    return path.join(getTemplatesPath(), ...segments);
  }

  /** The values of every placeholder there is; the type keeps the list complete. */
  private placeholderValues(): Record<Placeholder, string> {
    return {
      PROJECT_NAME: this.name,
      PROJECT_NAME_LOWER: this.name.toLowerCase(),
      PACKAGE_NAME: toDefaultPackageName(this.name),
    };
  }

  /** A file with its placeholders replaced. */
  private render(content: string): string {
    const values = this.placeholderValues();
    return content.replace(PLACEHOLDER, (_, placeholder: Placeholder) => values[placeholder]);
  }

  private async copyPlatform(platform: (typeof PLATFORM_TEMPLATES)[number]): Promise<void> {
    this.updateSpinner(`Copying ${platform} template...`);
    const platformPath = path.join(this.targetPath, platform);

    await copyDir(this.templatePath(platform), platformPath);
    await this.replacePlaceholders(platformPath);

    if (platform === 'android') {
      await this.moveKotlinSources(platformPath);
      await this.writeSdkLocation(platformPath);
    }
  }

  /** Replaces the placeholders in every text file of a copied template. */
  private async replacePlaceholders(dir: string): Promise<void> {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.replacePlaceholders(entryPath);
      } else if (!entry.name.endsWith('.jar')) {
        const content = await readFile(entryPath);
        const rendered = this.render(content);
        if (rendered !== content) {
          await writeFile(entryPath, rendered);
        }
      }
    }
  }

  /** The template keeps MainActivity.kt in a folder of its own; Gradle and Android Studio expect the package path. */
  private async moveKotlinSources(androidPath: string): Promise<void> {
    const templateDir = path.join(androidPath, 'app/src/main/kotlin/{{PACKAGE_NAME}}');
    if (!(await pathExists(templateDir))) {
      return;
    }

    const packagePath = this.placeholderValues().PACKAGE_NAME.replace(/\./g, '/');
    await fs.copy(
      templateDir,
      path.join(androidPath, 'app/src/main/java', ...packagePath.split('/'))
    );
    await fs.remove(path.join(androidPath, 'app/src/main/kotlin'));
  }

  /** Gradle finds the SDK through local.properties when ANDROID_HOME is not set. */
  private async writeSdkLocation(androidPath: string): Promise<void> {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const candidates = [
      process.env.ANDROID_HOME ?? '',
      process.env.ANDROID_SDK_ROOT ?? '',
      homeDir ? `${homeDir}/Android/Sdk` : '',
      homeDir ? `${homeDir}/android-sdk` : '',
      '/opt/android-sdk',
    ].filter((candidate) => candidate !== '');

    for (const candidate of candidates) {
      if (await pathExists(candidate)) {
        await writeFile(path.join(androidPath, 'local.properties'), `sdk.dir=${candidate}\n`);
        return;
      }
    }

    logger.warn('Android SDK not found. Set ANDROID_HOME or install Android Studio.');
    logger.warn('You can set the SDK path later in android/local.properties');
  }

  private async writeProjectFiles(): Promise<void> {
    this.updateSpinner('Creating project files...');
    await ensureDir(path.join(this.targetPath, 'lib'));

    await writeFile(
      path.join(this.targetPath, 'gyo.config.json'),
      await this.renderTemplate('gyo.config.json')
    );
    await writeFile(
      path.join(this.targetPath, 'README.md'),
      await this.renderTemplate('project', 'README.md')
    );
    await writeFile(
      path.join(this.targetPath, '.gitignore'),
      await this.renderTemplate('project', 'gitignore')
    );
  }

  private async renderTemplate(...segments: string[]): Promise<string> {
    return this.render(await readFile(this.templatePath(...segments)));
  }
}
