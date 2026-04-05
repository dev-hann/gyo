import * as path from 'path';
import fs from 'fs-extra';
import { BaseCommand, CommandMeta, BaseCommandOptions } from './base/index';
import { logger } from '../utils/logger';
import { ensureDir, copyDir, pathExists, writeFile, readFile, getTemplatesPath } from '../utils/fs';
import { GyoError, DirectoryExistsError } from '../core/index';

interface CreateCommandOptions extends BaseCommandOptions {
  projectName: string;
  template: string;
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

  getMeta(): CommandMeta {
    return {
      name: 'create <project-name>',
      description: 'Create a new gyo project',
      options: [
        { flags: '-t, --template <template>', description: 'Project template', default: 'react' },
      ],
    };
  }

  setProjectName(projectName: string): void {
    this.options = { ...this.options, projectName };
  }

  protected async run(): Promise<void> {
    this.targetPath = path.join(process.cwd(), this.options.projectName);
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

      this.succeedSpinner(`Project "${this.options.projectName}" created.`);
      this.showNextSteps();
    } catch (error) {
      if (error instanceof GyoError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.failSpinner(`Failed to create project: ${message}`);
      throw new GyoError(message);
    }
  }

  private validateProjectName(): void {
    if (!this.options.projectName || this.options.projectName.trim() === '') {
      throw new GyoError('Project name cannot be empty');
    }
  }

  private async validateProjectDirectory(): Promise<void> {
    if (await pathExists(this.targetPath)) {
      this.failSpinner('Directory already exists');
      throw new DirectoryExistsError(path.basename(this.targetPath));
    }
  }

  private createPlaceholderContext(): PlaceholderContext {
    const packageName = `com.example.${this.options.projectName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    return {
      projectName: this.options.projectName,
      projectNameLower: this.options.projectName.toLowerCase(),
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

    if (await pathExists(configSrcPath)) {
      let configContent = await readFile(configSrcPath);
      configContent = this.replaceContent(configContent, this.context);
      await writeFile(configDestPath, configContent);
    } else {
      await this.createDefaultConfig(configDestPath);
    }
  }

  private async createProjectFiles(): Promise<void> {
    this.updateSpinner('Creating project files...');

    const readmeContent = this.generateReadme(this.options.projectName);
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
    const androidHome =
      process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || `${process.env.HOME}/Android/Sdk`;

    const content = `sdk.dir=${androidHome}\n`;
    await writeFile(path.join(androidPath, 'local.properties'), content);
  }

  private async createDefaultConfig(configPath: string): Promise<void> {
    const defaultConfig = {
      name: this.context.projectName,
      version: '1.0.0',
      serverUrl: 'http://localhost:3000',
      platforms: {
        android: { enabled: true, packageName: this.context.packageName },
        ios: { enabled: true, bundleId: this.context.packageName },
        desktop: { enabled: false },
      },
    };
    await writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
  }

  private generateReadme(projectName: string): string {
    return `# ${projectName}

A cross-platform application built with gyo.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- For Android: Android Studio and Android SDK
- For iOS: Xcode (macOS only)

### Installation

\`\`\`bash
cd lib
npm install
\`\`\`

## Development

\`\`\`bash
gyo run android
gyo run ios
\`\`\`

## Build

\`\`\`bash
gyo build android
gyo build ios
\`\`\`

## Clean

\`\`\`bash
gyo clean android
gyo clean all
\`\`\`

## Project Structure

\`\`\`
${projectName}/
├── lib/                # React application
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── index.html
│   └── package.json
├── android/            # Android native shell
├── ios/                # iOS native shell
└── gyo.config.json
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
android/app/build/
android/build/
android/.gradle/
ios/build/
ios/Pods/
ios/*.xcworkspace
.gyo/cache/
`;
  }

  private showNextSteps(): void {
    logger.log('');
    logger.suggestNextSteps([
      `cd ${this.options.projectName}`,
      'gyo run android  # Run on Android',
      'gyo run ios      # Run on iOS',
    ]);
  }
}
