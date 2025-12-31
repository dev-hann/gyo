import { Command } from 'commander';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import ora from 'ora';
import { logger } from '../utils/logger';
import { loadConfig } from '../utils/config';
import { executeCommand, checkCommandExists } from '../utils/exec';
import { pathExists, readFile, writeFile } from '../utils/fs';

export function registerRunCommand(program: Command): void {
  program
    .command('run <platform>')
    .description('Run the application on a connected device or emulator')
    .option('-d, --device <device>', 'Specific device to run on')
    .action(async (platform: string, options: { device?: string }) => {
      await runPlatform(platform, options);
    });
}

let webServerProcess: ChildProcess | null = null;

async function runPlatform(platform: string, options: { device?: string }): Promise<void> {
  const spinner = ora(`Running ${platform} app...`).start();
  
  try {
    const validPlatforms = ['android', 'ios', 'desktop'];
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
    
    spinner.text = 'Starting web development server...';
    const libPath = path.join(process.cwd(), 'lib');
    const serverUrl = await startWebServer(libPath, config.devServer?.port || 3000);
    spinner.succeed(`Web server running at ${serverUrl}`);
    
    process.on('SIGINT', () => {
      logger.info('\nStopping web server...');
      if (webServerProcess) {
        webServerProcess.kill();
      }
      process.exit(0);
    });
    
    spinner.start(`Running ${platform} app...`);
    
    switch (platform) {
      case 'android':
        await runAndroid(options.device, spinner, serverUrl);
        break;
      case 'ios':
        await runIOS(options.device, spinner, serverUrl);
        break;
      case 'desktop':
        await runDesktop(spinner, serverUrl);
        break;
    }
    
  } catch (error) {
    spinner.fail(`Run failed: ${error}`);
    logger.error(error instanceof Error ? error.message : String(error));
    if (webServerProcess) {
      webServerProcess.kill();
    }
    process.exit(1);
  }
}

async function getLocalIP(): Promise<string> {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (iface) {
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          return alias.address;
        }
      }
    }
  }
  return 'localhost';
}

async function startWebServer(webPath: string, port: number): Promise<string> {
  // Check if node_modules exists
  const nodeModulesPath = path.join(webPath, 'node_modules');
  if (!(await pathExists(nodeModulesPath))) {
    logger.info('Installing web dependencies...');
    const installResult = await executeCommand('npm', ['install'], {
      cwd: webPath,
      stdio: 'inherit'
    });
    
    if (!installResult.success) {
      throw new Error('Failed to install web dependencies');
    }
  }
  
  // Start dev server
  webServerProcess = spawn('npm', ['run', 'dev'], {
    cwd: webPath,
    stdio: 'pipe',
    shell: true,
    detached: false
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const ip = await getLocalIP();
  return `http://${ip}:${port}`;
}

async function updateAndroidServerUrl(androidPath: string, serverUrl: string): Promise<void> {
  const mainActivityPath = path.join(androidPath, 'app/src/main/java/com/example');
  
  // Find MainActivity.kt
  const fs = require('fs-extra');
  const findMainActivity = async (dir: string): Promise<string | null> => {
    const files = await fs.readdir(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        const result = await findMainActivity(filePath);
        if (result) return result;
      } else if (file === 'MainActivity.kt') {
        return filePath;
      }
    }
    return null;
  };
  
  const mainActivityFile = await findMainActivity(mainActivityPath);
  if (mainActivityFile) {
    let content = await readFile(mainActivityFile);
    // Replace serverUrl in loadGyoConfig function
    content = content.replace(
      /serverUrl = "http:\/\/[^"]+"/,
      `serverUrl = "${serverUrl}"`
    );
    await writeFile(mainActivityFile, content);
  }
}

async function updateIOSServerUrl(iosPath: string, serverUrl: string): Promise<void> {
  const resourcesPath = path.join(iosPath, 'Sources/Resources');
  const configPath = path.join(resourcesPath, 'gyo-config.json');
  
  // Ensure Resources directory exists
  const fs = require('fs-extra');
  await fs.ensureDir(resourcesPath);
  
  // Write config file
  const config = {
    serverUrl: serverUrl
  };
  
  await writeFile(configPath, JSON.stringify(config, null, 2));
}

async function runAndroid(device: string | undefined, spinner: ora.Ora, serverUrl: string): Promise<void> {
  const androidPath = path.join(process.cwd(), 'android');
  
  if (!(await pathExists(androidPath))) {
    spinner.fail('Android project not found');
    logger.error('Build the Android project first: gyo build android');
    process.exit(1);
  }
  
  // Check if adb is available
  if (!(await checkCommandExists('adb'))) {
    spinner.fail('adb not found');
    logger.error('Please install Android SDK and add adb to your PATH');
    process.exit(1);
  }
  
  // Update server URL in MainActivity
  spinner.text = `Updating server URL to ${serverUrl}...`;
  await updateAndroidServerUrl(androidPath, serverUrl);
  
  // Check for connected devices
  spinner.text = 'Checking for connected devices...';
  const devicesResult = await executeCommand('adb', ['devices'], { stdio: 'pipe' });
  
  if (!devicesResult.success || !devicesResult.stdout.includes('device')) {
    spinner.fail('No Android devices found');
    logger.error('Connect a device or start an emulator');
    process.exit(1);
  }
  
  // Get first available device if not specified
  let selectedDevice = device;
  if (!selectedDevice) {
    const deviceLines = devicesResult.stdout.split('\n').filter(line => line.includes('\tdevice'));
    if (deviceLines.length > 0) {
      selectedDevice = deviceLines[0].split('\t')[0];
      if (deviceLines.length > 1) {
        logger.info(`Multiple devices found. Using: ${selectedDevice}`);
      }
    }
  }
  
  // Build and install
  const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  
  spinner.text = 'Building Android app...';
  const buildResult = await executeCommand(gradlew, ['assembleDebug'], {
    cwd: androidPath,
    stdio: 'pipe'
  });
  
  if (!buildResult.success) {
    spinner.fail('Build failed');
    process.exit(1);
  }
  
  spinner.text = 'Installing app on device...';
  const installResult = await executeCommand(gradlew, ['installDebug'], {
    cwd: androidPath,
    stdio: 'inherit'
  });
  
  if (!installResult.success) {
    spinner.fail('Failed to install app');
    process.exit(1);
  }
  
  // Get package name from build.gradle
  const packageName = await getAndroidPackageName(androidPath);
  
  // Launch the app
  spinner.text = 'Launching app...';
  if (packageName && selectedDevice) {
    const launchArgs = ['-s', selectedDevice, 'shell', 'am', 'start', '-n', `${packageName}/.MainActivity`];
    const launchResult = await executeCommand('adb', launchArgs, { stdio: 'pipe' });
    
    if (launchResult.success) {
      spinner.succeed('App installed and launched on Android device!');
    } else {
      spinner.succeed('App installed on Android device!');
      logger.warn('Could not auto-launch app. Please launch manually.');
    }
  } else {
    spinner.succeed('App installed on Android device!');
  }
  
  logger.log('');
  logger.success(`App is connected to: ${serverUrl}`);
  logger.info('Monitoring console logs (Press Ctrl+C to stop)...');
  logger.log('');
  
  // Start logcat monitoring
  const logcatArgs = ['logcat', '-v', 'brief', '-s', 'WebView-Console:*'];
  if (selectedDevice) {
    logcatArgs.unshift('-s', selectedDevice);
  }
  
  const logcat = spawn('adb', logcatArgs, {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  logcat.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim() && line.includes('WebView-Console')) {
        // Extract just the console message part
        const match = line.match(/WebView-Console:\s*(.+?)\s*(?:--\s*From line|$)/);
        if (match) {
          console.log(`📱 ${match[1]}`);
        } else {
          // Fallback: print whole line if pattern doesn't match
          console.log(`📱 ${line.trim()}`);
        }
      }
    }
  });
  
  logcat.stderr?.on('data', (data: Buffer) => {
    // Ignore stderr for now
  });
  
  // Keep process running
  await new Promise(() => {});
}

async function runIOS(device: string | undefined, spinner: ora.Ora, serverUrl: string): Promise<void> {
  const iosPath = path.join(process.cwd(), 'ios');
  
  if (!(await pathExists(iosPath))) {
    spinner.fail('iOS project not found');
    logger.error('Build the iOS project first: gyo build ios');
    process.exit(1);
  }
  
  if (!(await checkCommandExists('xtool'))) {
    spinner.fail('xtool not found');
    logger.error('Install xtool: https://xtool.sh');
    process.exit(1);
  }
  
  // Update server URL in config
  spinner.text = `Updating server URL to ${serverUrl}...`;
  await updateIOSServerUrl(iosPath, serverUrl);
  
  // Get bundle ID from xtool.yml
  let bundleId = await getIOSBundleId(iosPath);
  if (!bundleId) {
    spinner.fail('Could not read bundle ID from xtool.yml');
    process.exit(1);
  }
  
  spinner.text = 'Building and installing iOS app...';
  
  // Build and install the app, capture output to get full bundle ID
  const buildResult = await executeCommand('xtool', ['dev'], {
    cwd: iosPath,
    stdio: 'pipe'
  });
  
  if (!buildResult.success) {
    spinner.fail('Build failed');
    logger.error(buildResult.stderr || 'Unknown error');
    process.exit(1);
  }
  
  spinner.text = 'Finding installed app...';
  
  // Parse the build output to find the actual bundle ID used by xtool
  // xtool outputs the full bundle ID during the build/install process
  let fullBundleId = bundleId;
  const combinedOutput = (buildResult.stdout || '') + (buildResult.stderr || '');
  
  // Look for bundle ID patterns in the output
  // Pattern 1: Look for "bundleIDs = (" followed by the ID
  let match = combinedOutput.match(/bundleIDs\s*=\s*\(\s*"([^"]+)"/);
  if (match && match[1].includes(bundleId.split('.').pop() || '')) {
    fullBundleId = match[1];
  }
  
  // Pattern 2: Look for XTL-TEAMID.bundle.id pattern
  if (fullBundleId === bundleId) {
    match = combinedOutput.match(/(XTL-[A-Z0-9]+\.[a-z0-9.]+)/i);
    if (match && match[1].toLowerCase().includes(bundleId.split('.').pop()?.toLowerCase() || '')) {
      fullBundleId = match[1];
    }
  }
  
  // If still not found, try capturing from syslog for a short time
  if (fullBundleId === bundleId && bundleId && await checkCommandExists('idevicesyslog')) {
    spinner.text = 'Looking for installed app...';
    
    const syslogCapture = spawn('idevicesyslog', [], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    const foundBundleId = await new Promise<string>((resolve) => {
      let timeout: NodeJS.Timeout;
      let found = false;
      const safeBundleId = bundleId || '';
      
      syslogCapture.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        // Look for the bundle ID in device logs
        const patterns = [
          new RegExp(`(XTL-[A-Z0-9]+\\.${safeBundleId.replace(/\./g, '\\.')})`, 'i'),
          new RegExp(`bundleID[^:]*:\\s*([^\\s,}"]+${safeBundleId.split('.').pop()})`, 'i')
        ];
        
        for (const pattern of patterns) {
          const match = output.match(pattern);
          if (match && !found) {
            found = true;
            clearTimeout(timeout);
            syslogCapture.kill();
            resolve(match[1]);
            return;
          }
        }
      });
      
      // Timeout after 2 seconds
      timeout = setTimeout(() => {
        if (!found) {
          syslogCapture.kill();
          resolve(safeBundleId);
        }
      }, 2000);
    });
    
    if (foundBundleId !== bundleId) {
      fullBundleId = foundBundleId;
    }
  }
  
  if (fullBundleId !== bundleId) {
    logger.info(`Found full bundle ID: ${fullBundleId}`);
  } else {
    logger.info(`Using bundle ID: ${bundleId}`);
  }
  
  // App installed successfully
  spinner.succeed('App installed on iOS device!');
  bundleId = fullBundleId;
  
  logger.log('');
  logger.info('📱 Please tap the app icon on your device to launch it.');
  logger.log('');
  
  logger.log('');
  logger.success(`App is connected to: ${serverUrl}`);
  logger.info('Monitoring console logs (Press Ctrl+C to stop)...');
  logger.log('');
  
  // Start log monitoring if idevicesyslog is available
  if (await checkCommandExists('idevicesyslog')) {
    const syslog = spawn('idevicesyslog', ['-m', bundleId], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    syslog.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          console.log(`📱 ${line.trim()}`);
        }
      }
    });
    
    syslog.stderr?.on('data', (data: Buffer) => {
      // Ignore stderr for now
    });
  } else {
    logger.warn('idevicesyslog not found. Install libimobiledevice for log monitoring.');
  }
  
  // Keep process running
  await new Promise(() => {});
}

async function runDesktop(spinner: ora.Ora, serverUrl: string): Promise<void> {
  const desktopPath = path.join(process.cwd(), 'desktop');
  
  if (!(await pathExists(desktopPath))) {
    spinner.fail('Desktop project not found');
    logger.error('Build the desktop project first: gyo build desktop');
    process.exit(1);
  }
  
  spinner.text = 'Starting desktop app...';
  
  const runResult = await executeCommand('npm', ['start'], {
    cwd: desktopPath,
    stdio: 'inherit'
  });
  
  if (runResult.success) {
    spinner.succeed('Desktop app running!');
  } else {
    spinner.fail('Failed to run desktop app');
    process.exit(1);
  }
}

async function getAndroidPackageName(androidPath: string): Promise<string | null> {
  try {
    const buildGradlePath = path.join(androidPath, 'app/build.gradle');
    if (!(await pathExists(buildGradlePath))) {
      return null;
    }
    
    const content = await require('fs-extra').readFile(buildGradlePath, 'utf-8');
    const match = content.match(/applicationId\s+"([^"]+)"/);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

async function getIOSBundleId(iosPath: string): Promise<string | null> {
  try {
    const xtoolYmlPath = path.join(iosPath, 'xtool.yml');
    if (!(await pathExists(xtoolYmlPath))) {
      return null;
    }
    
    const content = await readFile(xtoolYmlPath);
    const match = content.match(/bundleID:\s*(.+)/);
    return match ? match[1].trim() : null;
  } catch (error) {
    return null;
  }
}
