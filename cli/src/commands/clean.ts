import { Command } from 'commander';
import * as path from 'path';
import ora from 'ora';
import { logger } from '../utils/logger.ts';
import { executeCommand } from '../utils/exec.ts';
import { pathExists, removeDir } from '../utils/fs.ts';

export function registerCleanCommand(program: Command): void {
  program
    .command('clean [platform]')
    .description('Clean build artifacts (android, ios, lib, or all)')
    .action(async (platform?: string) => {
      await cleanPlatform(platform || 'all');
    });
}

async function cleanPlatform(platform: string): Promise<void> {
  const spinner = ora('Cleaning build artifacts...').start();
  
  try {
    const validPlatforms = ['android', 'ios', 'lib', 'all'];
    if (!validPlatforms.includes(platform)) {
      spinner.fail(`Invalid platform: ${platform}`);
      logger.error(`Valid platforms are: ${validPlatforms.join(', ')}`);
      process.exit(1);
    }
    
    const platforms = platform === 'all' ? ['android', 'ios', 'lib'] : [platform];
    
    for (const p of platforms) {
      switch (p) {
        case 'android':
          await cleanAndroid(spinner);
          break;
        case 'ios':
          await cleanIOS(spinner);
          break;
        case 'lib':
          await cleanLib(spinner);
          break;
      }
    }
    
    spinner.succeed('Clean complete!');
    
  } catch (error) {
    spinner.fail(`Clean failed: ${error}`);
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function cleanAndroid(spinner: ora.Ora): Promise<void> {
  const androidPath = path.join(process.cwd(), 'android');
  
  if (!(await pathExists(androidPath))) {
    logger.warn('Android project not found, skipping');
    return;
  }
  
  spinner.text = 'Cleaning Android build...';
  
  const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  const cleanResult = await executeCommand(gradlew, ['clean'], {
    cwd: androidPath,
    stdio: 'pipe'
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

async function cleanIOS(spinner: ora.Ora): Promise<void> {
  const iosPath = path.join(process.cwd(), 'ios');
  
  if (!(await pathExists(iosPath))) {
    logger.warn('iOS project not found, skipping');
    return;
  }
  
  spinner.text = 'Cleaning iOS build...';
  
  const buildPath = path.join(iosPath, 'build');
  if (await pathExists(buildPath)) {
    await removeDir(buildPath);
    logger.success('iOS build cleaned');
  }
  
  const podsPath = path.join(iosPath, 'Pods');
  if (await pathExists(podsPath)) {
    await removeDir(podsPath);
    logger.success('iOS Pods cleaned');
  }
}

async function cleanLib(spinner: ora.Ora): Promise<void> {
  const libPath = path.join(process.cwd(), 'lib');
  
  if (!(await pathExists(libPath))) {
    logger.warn('Lib project not found, skipping');
    return;
  }
  
  spinner.text = 'Cleaning lib build...';
  
  const distPath = path.join(libPath, 'dist');
  if (await pathExists(distPath)) {
    await removeDir(distPath);
  }
  
  const nodeModulesPath = path.join(libPath, 'node_modules');
  if (await pathExists(nodeModulesPath)) {
    await removeDir(nodeModulesPath);
  }
  
  logger.success('Lib build cleaned');
}
