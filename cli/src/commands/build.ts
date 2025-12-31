import { Command } from 'commander';
import * as path from 'path';
import ora from 'ora';
import { logger } from '../utils/logger';
import { loadConfig } from '../utils/config';
import { executeCommand, checkCommandExists } from '../utils/exec';
import { pathExists } from '../utils/fs';

export function registerBuildCommand(program: Command): void {
  program
    .command('build <platform>')
    .description('Build the native application for the specified platform')
    .option('-r, --release', 'Build for release (production)', false)
    .action(async (platform: string, options: { release: boolean }) => {
      await buildPlatform(platform, options);
    });
}

async function buildPlatform(platform: string, options: { release: boolean }): Promise<void> {
  const spinner = ora(`Building for ${platform}...`).start();
  
  try {
    const validPlatforms = ['android', 'ios', 'desktop', 'lib'];
    if (!validPlatforms.includes(platform)) {
      spinner.fail(`Invalid platform: ${platform}`);
      logger.error(`Valid platforms are: ${validPlatforms.join(', ')}`);
      process.exit(1);
    }
    
    const config = await loadConfig();
    if (!config) {
      spinner.fail('Failed to load gyo.config.json');
      process.exit(1);
    }
    
    const platformKey = platform as keyof typeof config.platforms;
    if (config.platforms[platformKey] && !config.platforms[platformKey]?.enabled) {
      spinner.fail(`Platform ${platform} is not enabled in gyo.config.json`);
      process.exit(1);
    }
    
    spinner.text = 'Building lib assets...';
    const libPath = path.join(process.cwd(), 'lib');
    
    if (await pathExists(libPath)) {
      const libBuildResult = await executeCommand('npm', ['run', 'build'], {
        cwd: libPath,
        stdio: 'pipe'
      });
      
      if (!libBuildResult.success) {
        spinner.fail('Lib build failed');
        logger.error(libBuildResult.stderr);
        process.exit(1);
      }
      
      spinner.succeed('Lib assets built successfully');
    } else {
      logger.warn('Lib directory not found, skipping lib build');
    }
    
    if (platform === 'lib') {
      logger.success('Lib build complete!');
      return;
    }
    
    spinner.start(`Building ${platform} app...`);
    
    switch (platform) {
      case 'android':
        await buildAndroid(options.release, spinner);
        break;
      case 'ios':
        await buildIOS(options.release, spinner);
        break;
      case 'desktop':
        await buildDesktop(options.release, spinner);
        break;
    }
    
  } catch (error) {
    spinner.fail(`Build failed: ${error}`);
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function buildAndroid(release: boolean, spinner: ora.Ora): Promise<void> {
  const androidPath = path.join(process.cwd(), 'android');
  
  if (!(await pathExists(androidPath))) {
    spinner.fail('Android project not found');
    logger.error('Run: gyo init android');
    process.exit(1);
  }
  
  const task = release ? 'assembleRelease' : 'assembleDebug';
  const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  
  spinner.text = `Running ${task}...`;
  
  const result = await executeCommand(gradlew, [task], {
    cwd: androidPath,
    stdio: 'inherit'
  });
  
  if (result.success) {
    spinner.succeed('Android build complete!');
    const apkPath = release
      ? 'android/app/build/outputs/apk/release/app-release.apk'
      : 'android/app/build/outputs/apk/debug/app-debug.apk';
    logger.info(`APK location: ${apkPath}`);
  } else {
    spinner.fail('Android build failed');
    process.exit(1);
  }
}

async function buildIOS(release: boolean, spinner: ora.Ora): Promise<void> {
  const iosPath = path.join(process.cwd(), 'ios');
  
  if (!(await pathExists(iosPath))) {
    spinner.fail('iOS project not found');
    logger.error('Run: gyo init ios');
    process.exit(1);
  }
  
  if (!(await checkCommandExists('xtool'))) {
    spinner.fail('xtool not found');
    logger.error('Install xtool: https://xtool.sh');
    process.exit(1);
  }
  
  const configuration = release ? 'Release' : 'Debug';
  spinner.text = `Building iOS (${configuration})...`;
  
  const result = await executeCommand('xtool', ['dev', '--no-run'], {
    cwd: iosPath,
    stdio: 'inherit'
  });
  
  if (result.success) {
    spinner.succeed('iOS build complete!');
  } else {
    spinner.fail('iOS build failed');
    process.exit(1);
  }
}

async function buildDesktop(release: boolean, spinner: ora.Ora): Promise<void> {
  const desktopPath = path.join(process.cwd(), 'desktop');
  
  if (!(await pathExists(desktopPath))) {
    spinner.fail('Desktop project not found');
    logger.error('Run: gyo init desktop');
    process.exit(1);
  }
  
  spinner.text = 'Building desktop app...';
  
  // Assuming Electron or Tauri
  const result = await executeCommand('npm', ['run', 'build'], {
    cwd: desktopPath,
    stdio: 'inherit'
  });
  
  if (result.success) {
    spinner.succeed('Desktop build complete!');
  } else {
    spinner.fail('Desktop build failed');
    process.exit(1);
  }
}
