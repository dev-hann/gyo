import { Command } from "commander";
import * as path from "path";
import ora from "ora";
import fs from "fs-extra";
import { logger } from "../utils/logger.js";
import { ensureDir, copyDir, pathExists, writeFile, readFile } from "../utils/fs.js";
import { getTemplatesPath } from "../utils/fs.js";
import { GyoError, DirectoryExistsError, TemplateNotFoundError } from "../utils/errors.js";
import { suggestNextSteps } from "../utils/command-utils.js";

interface ProjectOptions {
  template: string;
}

interface PlaceholderContext {
  projectName: string;
  projectNameLower: string;
  packageName: string;
}

export function registerCreateCommand(program: Command): void {
  program
    .command("create <project-name>")
    .description("Create a new gyo project")
    .option(
      "-t, --template <template>",
      "Project template (default: react)",
      "react"
    )
    .action(async (projectName: string, options: ProjectOptions) => {
      await createProject(projectName, options);
    });
}

async function createProject(projectName: string, options: ProjectOptions): Promise<void> {
  const spinner = ora("Creating gyo project...").start();

  try {
    validateProjectName(projectName);

    const projectPath = path.join(process.cwd(), projectName);
    await validateProjectDirectory(projectPath, spinner);

    const context = createPlaceholderContext(projectName);

    await createProjectDirectory(projectPath, spinner);
    await setupAndroid(projectPath, context, spinner);
    await setupIOS(projectPath, context, spinner);
    await setupConfig(projectPath, context, spinner);
    await createProjectFiles(projectPath, context, spinner);

    spinner.succeed(`Project "${projectName}" created.`);
    showNextSteps(projectName);

  } catch (error) {
    if (error instanceof GyoError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    spinner.fail(`Failed to create project: ${message}`);
    throw new GyoError(message);
  }
}

function validateProjectName(projectName: string): void {
  if (!projectName || projectName.trim() === "") {
    throw new GyoError("Project name cannot be empty");
  }
}

async function validateProjectDirectory(projectPath: string, spinner: ora.Ora): Promise<void> {
  if (await pathExists(projectPath)) {
    spinner.fail(`Directory already exists`);
    throw new DirectoryExistsError(path.basename(projectPath));
  }
}

function createPlaceholderContext(projectName: string): PlaceholderContext {
  const packageName = `com.example.${projectName.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  return {
    projectName,
    projectNameLower: projectName.toLowerCase(),
    packageName
  };
}

async function createProjectDirectory(projectPath: string, spinner: ora.Ora): Promise<void> {
  spinner.text = "Creating project directory...";
  await ensureDir(projectPath);
  await ensureDir(path.join(projectPath, "lib"));
}

async function setupAndroid(
  projectPath: string,
  context: PlaceholderContext,
  spinner: ora.Ora
): Promise<void> {
  spinner.text = "Copying Android template...";
  const templatesPath = getTemplatesPath();
  const androidSrcPath = path.join(templatesPath, "android");
  const androidDestPath = path.join(projectPath, "android");

  if (!(await pathExists(androidSrcPath))) {
    logger.warn("Android template not found, skipping...");
    return;
  }

  await copyDir(androidSrcPath, androidDestPath);
  await replacePlaceholders(androidDestPath, context);
  await moveKotlinSources(androidDestPath, context.packageName);
  await createLocalProperties(androidDestPath);
}

async function setupIOS(
  projectPath: string,
  context: PlaceholderContext,
  spinner: ora.Ora
): Promise<void> {
  spinner.text = "Copying iOS template...";
  const templatesPath = getTemplatesPath();
  const iosSrcPath = path.join(templatesPath, "ios");
  const iosDestPath = path.join(projectPath, "ios");

  if (!(await pathExists(iosSrcPath))) {
    logger.warn("iOS template not found, skipping...");
    return;
  }

  await copyDir(iosSrcPath, iosDestPath);
  await replacePlaceholders(iosDestPath, context);
}

async function setupConfig(
  projectPath: string,
  context: PlaceholderContext,
  spinner: ora.Ora
): Promise<void> {
  spinner.text = "Creating configuration...";
  const templatesPath = getTemplatesPath();
  const configSrcPath = path.join(templatesPath, "gyo.config.json");
  const configDestPath = path.join(projectPath, "gyo.config.json");

  if (await pathExists(configSrcPath)) {
    let configContent = await readFile(configSrcPath);
    configContent = replaceContent(configContent, context);
    await writeFile(configDestPath, configContent);
  } else {
    await createDefaultConfig(configDestPath, context);
  }
}

async function createProjectFiles(
  projectPath: string,
  context: PlaceholderContext,
  spinner: ora.Ora
): Promise<void> {
  spinner.text = "Creating project files...";
  
  const readmeContent = generateReadme(context.projectName);
  await writeFile(path.join(projectPath, "README.md"), readmeContent);

  const gitignoreContent = generateGitignore();
  await writeFile(path.join(projectPath, ".gitignore"), gitignoreContent);
}

async function replacePlaceholders(dirPath: string, context: PlaceholderContext): Promise<void> {
  const files = await fs.readdir(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      await replacePlaceholders(filePath, context);
    } else if (stat.isFile()) {
      let content = await readFile(filePath);
      if (hasPlaceholders(content)) {
        content = replaceContent(content, context);
        await writeFile(filePath, content);
      }
    }
  }
}

function hasPlaceholders(content: string): boolean {
  return (
    content.includes("{{PROJECT_NAME}}") ||
    content.includes("{{PROJECT_NAME_LOWER}}") ||
    content.includes("{{PACKAGE_NAME}}")
  );
}

function replaceContent(content: string, context: PlaceholderContext): string {
  return content
    .replace(/\{\{PROJECT_NAME\}\}/g, context.projectName)
    .replace(/\{\{PROJECT_NAME_LOWER\}\}/g, context.projectNameLower)
    .replace(/\{\{PACKAGE_NAME\}\}/g, context.packageName);
}

async function moveKotlinSources(androidPath: string, packageName: string): Promise<void> {
  const kotlinTemplateDir = path.join(androidPath, "app/src/main/kotlin/{{PACKAGE_NAME}}");
  
  if (!(await pathExists(kotlinTemplateDir))) {
    return;
  }

  const packagePath = packageName.replace(/\./g, "/");
  const kotlinDestDir = path.join(androidPath, `app/src/main/java/${packagePath}`);
  await ensureDir(kotlinDestDir);

  await fs.copy(kotlinTemplateDir, kotlinDestDir, { overwrite: true });

  const kotlinDir = path.join(androidPath, "app/src/main/kotlin");
  if (await pathExists(kotlinDir)) {
    await fs.remove(kotlinDir);
  }
}

async function createLocalProperties(androidPath: string): Promise<void> {
  const androidHome =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    `${process.env.HOME}/Android/Sdk`;
  
  const content = `sdk.dir=${androidHome}\n`;
  await writeFile(path.join(androidPath, "local.properties"), content);
}

async function createDefaultConfig(configPath: string, context: PlaceholderContext): Promise<void> {
  const defaultConfig = {
    name: context.projectName,
    version: "1.0.0",
    serverUrl: "http://localhost:3000",
    platforms: {
      android: { enabled: true, packageName: context.packageName },
      ios: { enabled: true, bundleId: context.packageName },
      desktop: { enabled: false },
    },
  };
  await writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
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

function generateGitignore(): string {
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

function showNextSteps(projectName: string): void {
  logger.log("");
  suggestNextSteps([
    `cd ${projectName}`,
    "gyo run android  # Run on Android",
    "gyo run ios      # Run on iOS"
  ]);
}
