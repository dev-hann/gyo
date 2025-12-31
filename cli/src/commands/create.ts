import { Command } from 'commander';
import * as path from 'path';
import ora from 'ora';
import { logger } from '../utils/logger';
import { ensureDir, copyDir, pathExists, writeFile, readFile } from '../utils/fs';
import { getTemplatesPath } from '../utils/fs';

export function registerCreateCommand(program: Command): void {
  program
    .command('create <project-name>')
    .description('Create a new gyo project')
    .option('-t, --template <template>', 'Project template (default: react)', 'react')
    .action(async (projectName: string, options: { template: string }) => {
      await createProject(projectName, options);
    });
}

async function createProject(projectName: string, options: { template: string }): Promise<void> {
  const spinner = ora('Creating gyo project...').start();
  
  try {
    if (!projectName || projectName.trim() === '') {
      spinner.fail('Project name cannot be empty');
      process.exit(1);
    }
    
    const projectPath = path.join(process.cwd(), projectName);
    if (await pathExists(projectPath)) {
      spinner.fail(`Directory "${projectName}" already exists`);
      process.exit(1);
    }
    
    spinner.text = 'Creating project directory...';
    await ensureDir(projectPath);
    
    const templatesPath = getTemplatesPath();
    
    spinner.text = 'Copying lib template...';
    const libTemplatePath = path.join(templatesPath, 'lib');
    const libDestPath = path.join(projectPath, 'lib');
    
    if (await pathExists(libTemplatePath)) {
      await copyDir(libTemplatePath, libDestPath);
      await replacePlaceholders(libDestPath, projectName);
    } else {
      logger.warn('Lib template not found, creating minimal structure...');
      await ensureDir(libDestPath);
    }
    
    spinner.text = 'Copying Android template...';
    const androidTemplatePath = path.join(templatesPath, 'android');
    const androidDestPath = path.join(projectPath, 'android');
    
    if (await pathExists(androidTemplatePath)) {
      await copyDir(androidTemplatePath, androidDestPath);
      
      const packageName = `com.example.${projectName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      await replacePlaceholdersAndroid(androidDestPath, projectName, packageName);
      
      const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || `${process.env.HOME}/Android/Sdk`;
      const localPropertiesContent = `sdk.dir=${androidHome}\n`;
      await writeFile(path.join(androidDestPath, 'local.properties'), localPropertiesContent);
    } else {
      logger.warn('Android template not found, skipping...');
    }
    
    spinner.text = 'Copying iOS template...';
    const iosTemplatePath = path.join(templatesPath, 'ios');
    const iosDestPath = path.join(projectPath, 'ios');
    
    if (await pathExists(iosTemplatePath)) {
      await copyDir(iosTemplatePath, iosDestPath);
      await replacePlaceholders(iosDestPath, projectName);
    } else {
      logger.warn('iOS template not found, skipping...');
    }
    
    spinner.text = 'Creating configuration...';
    const configTemplatePath = path.join(templatesPath, 'gyo.config.json');
    const configDestPath = path.join(projectPath, 'gyo.config.json');
    const packageName = `com.example.${projectName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    if (await pathExists(configTemplatePath)) {
      let configContent = await readFile(configTemplatePath);
      configContent = configContent.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
      configContent = configContent.replace(/\{\{PROJECT_NAME_LOWER\}\}/g, projectName.toLowerCase());
      configContent = configContent.replace(/\{\{PACKAGE_NAME\}\}/g, packageName);
      await writeFile(configDestPath, configContent);
    } else {
      const defaultConfig = {
        name: projectName,
        version: '1.0.0',
        serverUrl: 'http://localhost:3000',
        platforms: {
          android: { enabled: true, packageName },
          ios: { enabled: true, bundleId: packageName },
          desktop: { enabled: false }
        }
      };
      await writeFile(configDestPath, JSON.stringify(defaultConfig, null, 2));
    }
    
    spinner.text = 'Creating project files...';
    const readmeContent = generateReadme(projectName);
    await writeFile(path.join(projectPath, 'README.md'), readmeContent);
    
    const gitignoreContent = `node_modules/
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
`;
    await writeFile(path.join(projectPath, '.gitignore'), gitignoreContent);
    
    spinner.succeed(`Project "${projectName}" created successfully!`);
    
    logger.log('');
    logger.success('Next steps:');
    logger.info(`  cd ${projectName}`);
    logger.info('  cd lib && npm install');
    logger.info('  gyo run android');
    logger.log('');
    
  } catch (error) {
    spinner.fail(`Failed to create project: ${error}`);
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function replacePlaceholders(dirPath: string, projectName: string): Promise<void> {
  const fs = require('fs-extra');
  const files = await fs.readdir(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isDirectory()) {
      await replacePlaceholders(filePath, projectName);
    } else if (stat.isFile()) {
      let content = await readFile(filePath);
      if (content.includes('{{PROJECT_NAME}}') || content.includes('{{PROJECT_NAME_LOWER}}')) {
        content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
        content = content.replace(/\{\{PROJECT_NAME_LOWER\}\}/g, projectName.toLowerCase());
        await writeFile(filePath, content);
      }
    }
  }
}

async function replacePlaceholdersAndroid(dirPath: string, projectName: string, packageName: string): Promise<void> {
  const fs = require('fs-extra');
  const files = await fs.readdir(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isDirectory()) {
      await replacePlaceholdersAndroid(filePath, projectName, packageName);
    } else if (stat.isFile()) {
      let content = await readFile(filePath);
      const hasPlaceholder = content.includes('{{PROJECT_NAME}}') || 
                            content.includes('{{PROJECT_NAME_LOWER}}') ||
                            content.includes('{{PACKAGE_NAME}}');
      
      if (hasPlaceholder) {
        content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
        content = content.replace(/\{\{PROJECT_NAME_LOWER\}\}/g, projectName.toLowerCase());
        content = content.replace(/\{\{PACKAGE_NAME\}\}/g, packageName);
        await writeFile(filePath, content);
      }
    }
  }
  
  // Move MainActivity.kt to correct package directory
  const mainActivitySrc = path.join(dirPath, 'app/src/main/kotlin/MainActivity.kt');
  if (await pathExists(mainActivitySrc)) {
    const packagePath = packageName.replace(/\./g, '/');
    const kotlinDestDir = path.join(dirPath, `app/src/main/java/${packagePath}`);
    await ensureDir(kotlinDestDir);
    
    const mainActivityDest = path.join(kotlinDestDir, 'MainActivity.kt');
    await fs.move(mainActivitySrc, mainActivityDest, { overwrite: true });
    
    // Remove empty kotlin directory
    const kotlinDir = path.join(dirPath, 'app/src/main/kotlin');
    if (await pathExists(kotlinDir)) {
      await fs.remove(kotlinDir);
    }
  }
}

function generateReadme(projectName: string): string {
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
