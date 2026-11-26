import * as path from 'path';
import fs from 'fs-extra';
import type { CommandMeta, BaseCommandOptions } from './base/index';
import { BaseCommand } from './base/index';
import { logger } from '../utils/logger';
import { ensureDir, copyDir, pathExists, writeFile, readFile, getTemplatesPath } from '../utils/fs';
import {
  GyoError,
  DirectoryExistsError,
  getErrorMessage,
  toDefaultPackageName,
} from '../core/index';

interface CreateCommandOptions extends BaseCommandOptions {
  projectName?: string;
  force?: boolean;
}

interface PlaceholderContext {
  projectName: string;
  projectNameLower: string;
  packageName: string;
}

interface PlatformConfig {
  name: string;
  extraSteps?: (platformPath: string, context: PlaceholderContext) => Promise<void>;
}

export class CreateCommand extends BaseCommand<CreateCommandOptions> {
  private context!: PlaceholderContext;
  private targetPath!: string;
  private validatedName: string = '';

  getMeta(): CommandMeta {
    return {
      name: 'create <project-name>',
      description: 'Create a new gyo project (native shell + config — bring your own web app)',
      positionalHandler: 'projectName',
      options: [
        {
          flags: '-f, --force',
          description: 'Overwrite existing project directory',
        },
      ],
    };
  }

  setProjectName(projectName: string): void {
    this.options = { ...this.options, projectName };
  }

  protected async run(): Promise<void> {
    this.validatedName = this.options.projectName || '';
    this.targetPath = path.join(process.cwd(), this.validatedName);
    this.startSpinner('Creating gyo project...');

    try {
      this.validateProjectName();
      await this.validateProjectDirectory();

      this.context = this.createPlaceholderContext();

      await this.createProjectDirectory();

      const platforms = this.getPlatforms();
      for (const platform of platforms) {
        await this.setupPlatform(platform);
      }

      await this.setupConfig();
      await this.createProjectFiles();

      this.succeedSpinner(`Project structure created.`);
      this.showNextSteps();
    } catch (error) {
      if (error instanceof GyoError) {
        throw error;
      }
      const message = getErrorMessage(error);
      throw new GyoError(message, 1, { cause: error });
    }
  }

  private validateProjectName(): void {
    const name = this.validatedName;
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
    if (await pathExists(this.targetPath)) {
      if (this.options.force) {
        logger.warn(`Removing existing directory: ${this.targetPath}`);
        await fs.remove(this.targetPath);
      } else {
        throw new DirectoryExistsError(path.basename(this.targetPath), this.targetPath);
      }
    }
  }

  private createPlaceholderContext(): PlaceholderContext {
    const packageName = toDefaultPackageName(this.validatedName);
    return {
      projectName: this.validatedName,
      projectNameLower: this.validatedName.toLowerCase(),
      packageName,
    };
  }

  private async createProjectDirectory(): Promise<void> {
    this.updateSpinner('Creating project directory...');
    await ensureDir(this.targetPath);
    await ensureDir(path.join(this.targetPath, 'lib'));
  }

  private getPlatforms(): PlatformConfig[] {
    return [
      { name: 'android', extraSteps: this.setupAndroidExtras.bind(this) },
      { name: 'ios', extraSteps: undefined },
    ];
  }

  private async setupPlatform(platform: PlatformConfig): Promise<void> {
    this.updateSpinner(`Copying ${platform.name} template...`);
    const templatesPath = getTemplatesPath();
    const srcPath = path.join(templatesPath, platform.name);
    const destPath = path.join(this.targetPath, platform.name);

    if (!(await pathExists(srcPath))) {
      logger.warn(`${platform.name} template not found, skipping...`);
      return;
    }

    await copyDir(srcPath, destPath);
    await this.replacePlaceholders(destPath, this.context);

    if (platform.extraSteps) {
      await platform.extraSteps(destPath, this.context);
    }
  }

  private async setupAndroidExtras(
    androidPath: string,
    context: PlaceholderContext
  ): Promise<void> {
    await this.moveKotlinSources(androidPath, context.packageName);
    await this.createLocalProperties(androidPath);
  }

  private async setupConfig(): Promise<void> {
    this.updateSpinner('Creating configuration...');
    const templatesPath = getTemplatesPath();
    const configSrcPath = path.join(templatesPath, 'gyo.config.json');
    const configDestPath = path.join(this.targetPath, 'gyo.config.json');

    let configContent: string;

    if (await pathExists(configSrcPath)) {
      configContent = await readFile(configSrcPath);
      configContent = this.replaceContent(configContent, this.context);
    } else {
      configContent = JSON.stringify(this.createDefaultConfigObject(), null, 2);
    }

    await writeFile(configDestPath, configContent);
  }

  private createDefaultConfigObject(): Record<string, unknown> {
    return {
      name: this.context.projectName,
      version: '1.0.0',
      profiles: {
        development: {
          serverUrl: 'http://localhost:3000',
        },
      },
      platforms: {
        android: { enabled: true, packageName: this.context.packageName },
        ios: { enabled: true, bundleId: this.context.packageName },
      },
      webview: {
        allowFileAccess: false,
        allowUniversalAccessFromFileURLs: false,
        userAgent: 'gyo-webview/1.0',
      },
      script: {
        start: 'npm run dev',
      },
    };
  }

  private async createProjectFiles(): Promise<void> {
    this.updateSpinner('Creating project files...');

    const readmeContent = this.generateReadme(this.validatedName);
    await writeFile(path.join(this.targetPath, 'README.md'), readmeContent);

    const gitignoreContent = this.generateGitignore();
    await writeFile(path.join(this.targetPath, '.gitignore'), gitignoreContent);
  }

  private async replacePlaceholders(dirPath: string, context: PlaceholderContext): Promise<void> {
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        await this.replacePlaceholders(filePath, context);
      } else if (stat.isFile()) {
        let content = await readFile(filePath);
        if (this.hasPlaceholders(content)) {
          content = this.replaceContent(content, context);
          await writeFile(filePath, content);
        }
      }
    }
  }

  private hasPlaceholders(content: string): boolean {
    return (
      content.includes('{{PROJECT_NAME}}') ||
      content.includes('{{PROJECT_NAME_LOWER}}') ||
      content.includes('{{PACKAGE_NAME}}')
    );
  }

  private replaceContent(content: string, context: PlaceholderContext): string {
    return content
      .replace(/\{\{PROJECT_NAME\}\}/g, context.projectName)
      .replace(/\{\{PROJECT_NAME_LOWER\}\}/g, context.projectNameLower)
      .replace(/\{\{PACKAGE_NAME\}\}/g, context.packageName);
  }

  private async moveKotlinSources(androidPath: string, packageName: string): Promise<void> {
    const kotlinTemplateDir = path.join(androidPath, 'app/src/main/kotlin/{{PACKAGE_NAME}}');

    if (!(await pathExists(kotlinTemplateDir))) {
      return;
    }

    const packagePath = packageName.replace(/\./g, '/');
    const kotlinDestDir = path.join(androidPath, `app/src/main/java/${packagePath}`);
    await ensureDir(kotlinDestDir);

    await fs.copy(kotlinTemplateDir, kotlinDestDir, { overwrite: true });

    const kotlinDir = path.join(androidPath, 'app/src/main/kotlin');
    if (await pathExists(kotlinDir)) {
      await fs.remove(kotlinDir);
    }
  }

  private async createLocalProperties(androidPath: string): Promise<void> {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const candidates: string[] = [
      process.env.ANDROID_HOME ?? '',
      process.env.ANDROID_SDK_ROOT ?? '',
      homeDir ? `${homeDir}/Android/Sdk` : '',
      homeDir ? `${homeDir}/android-sdk` : '',
      '/opt/android-sdk',
    ].filter((c) => c !== '');

    let sdkPath: string | undefined;
    for (const candidate of candidates) {
      if (await pathExists(candidate)) {
        sdkPath = candidate;
        break;
      }
    }

    if (!sdkPath) {
      logger.warn('Android SDK not found. Set ANDROID_HOME or install Android Studio.');
      logger.warn('You can set the SDK path later in android/local.properties');
      return;
    }

    const content = `sdk.dir=${sdkPath}\n`;
    await writeFile(path.join(androidPath, 'local.properties'), content);
  }

  private generateReadme(projectName: string): string {
    return `# ${projectName}

A cross-platform application built with gyo.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- For Android: Android Studio and Android SDK
- For iOS: Xcode (macOS only)

## 1. Add your web application

The native shell loads a web app served over HTTP. Put any web application
(React, Next.js, Vue, Svelte, plain HTML...) in \`lib/\`:

\`\`\`bash
cd ${projectName}/lib
npm create vite@latest .        # or any framework of your choice
npm install
\`\`\`

## 2. Configure the dev server

Edit \`gyo.config.json\`:

- \`script.start\` — command that starts your dev server
- \`profiles.development.serverUrl\` — the URL your dev server serves on

Your dev server must listen on \`0.0.0.0\` (not just localhost) so the
device on the same network can reach it, e.g. for Vite:

\`\`\`bash
npm run dev -- --host 0.0.0.0
\`\`\`

Set \`script.start\` to the exact command including the host flag.

## 3. Run

\`\`\`bash
cd ${projectName}
gyo run
\`\`\`

## Build

\`\`\`bash
gyo build android      # will ask for the deploy URL if not configured
gyo build ios
\`\`\`

Deploy your web app to a server, then build with the production profile:

\`\`\`bash
gyo build android -p production
\`\`\`

## Project Structure

\`\`\`
${projectName}/
├── lib/                # Your web application (any framework)
│   └── package.json
├── android/            # Android native shell
├── ios/                # iOS native shell
└── gyo.config.json     # server URL + start script configuration
\`\`\`
`;
  }

  private generateGitignore(): string {
    return `node_modules/
dist/
build/
.DS_Store
*.log
.env
.env.local
.gradle/
*.iml
.idea/
local.properties
android/build/
android/.gradle/
android/app/src/main/assets/gyo-config.json
ios/build/
ios/Pods/
ios/*.xcworkspace
.gyo/cache/
`;
  }

  private showNextSteps(): void {
    logger.suggestNextSteps([
      `cd ${this.validatedName}`,
      'Create your web app in lib/ (any framework)',
      'Set script.start in gyo.config.json',
      'gyo run          # Run on connected device',
    ]);
  }
}
