"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCreateCommand = registerCreateCommand;
const path = __importStar(require("path"));
const ora_1 = __importDefault(require("ora"));
const logger_1 = require("../utils/logger");
const fs_1 = require("../utils/fs");
const fs_2 = require("../utils/fs");
function registerCreateCommand(program) {
    program
        .command('create <project-name>')
        .description('Create a new gyo project')
        .option('-t, --template <template>', 'Project template (default: react)', 'react')
        .action(async (projectName, options) => {
        await createProject(projectName, options);
    });
}
async function createProject(projectName, options) {
    const spinner = (0, ora_1.default)('Creating gyo project...').start();
    try {
        if (!projectName || projectName.trim() === '') {
            spinner.fail('Project name cannot be empty');
            process.exit(1);
        }
        const projectPath = path.join(process.cwd(), projectName);
        if (await (0, fs_1.pathExists)(projectPath)) {
            spinner.fail(`Directory "${projectName}" already exists`);
            process.exit(1);
        }
        spinner.text = 'Creating project directory...';
        await (0, fs_1.ensureDir)(projectPath);
        const templatesPath = (0, fs_2.getTemplatesPath)();
        spinner.text = 'Copying lib template...';
        const libTemplatePath = path.join(templatesPath, 'lib');
        const libDestPath = path.join(projectPath, 'lib');
        if (await (0, fs_1.pathExists)(libTemplatePath)) {
            await (0, fs_1.copyDir)(libTemplatePath, libDestPath);
            await replacePlaceholders(libDestPath, projectName);
        }
        else {
            logger_1.logger.warn('Lib template not found, creating minimal structure...');
            await (0, fs_1.ensureDir)(libDestPath);
        }
        spinner.text = 'Copying Android template...';
        const androidTemplatePath = path.join(templatesPath, 'android');
        const androidDestPath = path.join(projectPath, 'android');
        if (await (0, fs_1.pathExists)(androidTemplatePath)) {
            await (0, fs_1.copyDir)(androidTemplatePath, androidDestPath);
            const packageName = `com.example.${projectName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            await replacePlaceholdersAndroid(androidDestPath, projectName, packageName);
            const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || `${process.env.HOME}/Android/Sdk`;
            const localPropertiesContent = `sdk.dir=${androidHome}\n`;
            await (0, fs_1.writeFile)(path.join(androidDestPath, 'local.properties'), localPropertiesContent);
        }
        else {
            logger_1.logger.warn('Android template not found, skipping...');
        }
        spinner.text = 'Copying iOS template...';
        const iosTemplatePath = path.join(templatesPath, 'ios');
        const iosDestPath = path.join(projectPath, 'ios');
        if (await (0, fs_1.pathExists)(iosTemplatePath)) {
            await (0, fs_1.copyDir)(iosTemplatePath, iosDestPath);
            await replacePlaceholders(iosDestPath, projectName);
        }
        else {
            logger_1.logger.warn('iOS template not found, skipping...');
        }
        spinner.text = 'Creating configuration...';
        const configTemplatePath = path.join(templatesPath, 'gyo.config.json');
        const configDestPath = path.join(projectPath, 'gyo.config.json');
        const packageName = `com.example.${projectName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        if (await (0, fs_1.pathExists)(configTemplatePath)) {
            let configContent = await (0, fs_1.readFile)(configTemplatePath);
            configContent = configContent.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
            configContent = configContent.replace(/\{\{PROJECT_NAME_LOWER\}\}/g, projectName.toLowerCase());
            configContent = configContent.replace(/\{\{PACKAGE_NAME\}\}/g, packageName);
            await (0, fs_1.writeFile)(configDestPath, configContent);
        }
        else {
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
            await (0, fs_1.writeFile)(configDestPath, JSON.stringify(defaultConfig, null, 2));
        }
        spinner.text = 'Creating project files...';
        const readmeContent = generateReadme(projectName);
        await (0, fs_1.writeFile)(path.join(projectPath, 'README.md'), readmeContent);
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
        await (0, fs_1.writeFile)(path.join(projectPath, '.gitignore'), gitignoreContent);
        spinner.succeed(`Project "${projectName}" created successfully!`);
        logger_1.logger.log('');
        logger_1.logger.success('Next steps:');
        logger_1.logger.info(`  cd ${projectName}`);
        logger_1.logger.info('  cd lib && npm install');
        logger_1.logger.info('  gyo run android');
        logger_1.logger.log('');
    }
    catch (error) {
        spinner.fail(`Failed to create project: ${error}`);
        logger_1.logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}
async function replacePlaceholders(dirPath, projectName) {
    const fs = require('fs-extra');
    const files = await fs.readdir(dirPath);
    for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
            await replacePlaceholders(filePath, projectName);
        }
        else if (stat.isFile()) {
            let content = await (0, fs_1.readFile)(filePath);
            if (content.includes('{{PROJECT_NAME}}') || content.includes('{{PROJECT_NAME_LOWER}}')) {
                content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
                content = content.replace(/\{\{PROJECT_NAME_LOWER\}\}/g, projectName.toLowerCase());
                await (0, fs_1.writeFile)(filePath, content);
            }
        }
    }
}
async function replacePlaceholdersAndroid(dirPath, projectName, packageName) {
    const fs = require('fs-extra');
    const files = await fs.readdir(dirPath);
    for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
            await replacePlaceholdersAndroid(filePath, projectName, packageName);
        }
        else if (stat.isFile()) {
            let content = await (0, fs_1.readFile)(filePath);
            const hasPlaceholder = content.includes('{{PROJECT_NAME}}') ||
                content.includes('{{PROJECT_NAME_LOWER}}') ||
                content.includes('{{PACKAGE_NAME}}');
            if (hasPlaceholder) {
                content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
                content = content.replace(/\{\{PROJECT_NAME_LOWER\}\}/g, projectName.toLowerCase());
                content = content.replace(/\{\{PACKAGE_NAME\}\}/g, packageName);
                await (0, fs_1.writeFile)(filePath, content);
            }
        }
    }
    // Move MainActivity.kt to correct package directory
    const mainActivitySrc = path.join(dirPath, 'app/src/main/kotlin/MainActivity.kt');
    if (await (0, fs_1.pathExists)(mainActivitySrc)) {
        const packagePath = packageName.replace(/\./g, '/');
        const kotlinDestDir = path.join(dirPath, `app/src/main/java/${packagePath}`);
        await (0, fs_1.ensureDir)(kotlinDestDir);
        const mainActivityDest = path.join(kotlinDestDir, 'MainActivity.kt');
        await fs.move(mainActivitySrc, mainActivityDest, { overwrite: true });
        // Remove empty kotlin directory
        const kotlinDir = path.join(dirPath, 'app/src/main/kotlin');
        if (await (0, fs_1.pathExists)(kotlinDir)) {
            await fs.remove(kotlinDir);
        }
    }
}
function generateReadme(projectName) {
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
//# sourceMappingURL=create.js.map