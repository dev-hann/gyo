import { execFile, execSync, spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import fs from 'fs-extra';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const ROOT_DIR = path.resolve(__dirname, '../..');
const CLI_PATH = path.join(ROOT_DIR, 'cli/dist/index.js');
const BRIDGE_PATH = path.join(ROOT_DIR, 'bridge');

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function execCLI(
  args: string[],
  options?: { cwd?: string; timeout?: number }
): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], {
      cwd: options?.cwd,
      timeout: options?.timeout ?? 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; code?: string; killed?: boolean };
    if (error.killed) {
      throw new Error(`CLI timed out: node ${CLI_PATH} ${args.join(' ')}`);
    }
    return {
      exitCode: 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  }
}

export async function exec(
  cmd: string,
  options?: { cwd?: string; timeout?: number }
): Promise<ExecResult> {
  const { exec: execCmd } = await import('child_process');
  return new Promise((resolve, reject) => {
    execCmd(
      cmd,
      { cwd: options?.cwd, timeout: options?.timeout ?? 120_000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err && (err as { killed?: boolean }).killed) {
          reject(new Error(`Command timed out: ${cmd}`));
          return;
        }
        resolve({ exitCode: err ? 1 : 0, stdout: stdout ?? '', stderr: stderr ?? '' });
      }
    );
  });
}

export function spawnCLI(args: string[], options?: { cwd?: string }) {
  return spawn('node', [CLI_PATH, ...args], {
    cwd: options?.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
  });
}

export async function createTempDir(prefix = 'gyo-e2e-'): Promise<string> {
  const dir = path.join(os.tmpdir(), `${prefix}${Date.now()}`);
  await fs.ensureDir(dir);
  return dir;
}

export async function cleanupDir(dir: string): Promise<void> {
  await fs.remove(dir).catch(() => {});
}

export async function getAdbDeviceId(): Promise<string | null> {
  const result = await exec('adb devices');
  const lines = result.stdout.split('\n').slice(1);
  for (const line of lines) {
    const match = line.trim().match(/^(\S+)\s+device$/);
    if (match) return match[1];
  }
  return null;
}

/**
 * The attached Android devices, emulators first. Read while a test file is
 * being evaluated, where a skip is decided and nothing can be awaited, so
 * unlike `getAdbDeviceId` it does not go through a callback.
 */
export function adbDeviceIds(): string[] {
  let output: string;
  try {
    output = execSync('adb devices', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000 }).toString();
  } catch {
    return [];
  }
  const ids = output
    .split('\n')
    .slice(1)
    .map((line) => line.trim().match(/^(\S+)\s+device$/)?.[1])
    .filter((id): id is string => id !== undefined);
  return [...ids.filter((id) => id.startsWith('emulator-')), ...ids.filter((id) => !id.startsWith('emulator-'))];
}

export async function getIosDeviceId(): Promise<string | null> {
  const result = await exec('xtool devices 2>/dev/null || true');
  const match = result.stdout.match(/\b[0-9a-f]{40}\b/);
  return match ? match[0] : null;
}

export async function isAndroidAppRunning(packageName: string): Promise<boolean> {
  const result = await exec(`adb shell pidof ${packageName} 2>/dev/null || true`);
  return result.stdout.trim().length > 0;
}

export async function isAndroidAppInstalled(packageName: string): Promise<boolean> {
  const result = await exec(`adb shell pm list packages ${packageName} 2>/dev/null || true`);
  return result.stdout.includes(packageName);
}

export async function uninstallAndroidApp(packageName: string): Promise<void> {
  await exec(`adb uninstall ${packageName} 2>/dev/null || true`);
}

export async function uninstallIosApp(bundleId: string): Promise<void> {
  await exec(`xtool uninstall ${bundleId} 2>/dev/null || true`);
}

export async function waitForAndroidApp(packageName: string, timeoutMs = 60_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isAndroidAppRunning(packageName)) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

export function waitForOutput(
  child: ReturnType<typeof spawn>,
  pattern: string | RegExp,
  timeoutMs = 120_000
): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${pattern} in output:\n${output.slice(-2000)}`));
    }, timeoutMs);

    const onStdout = (data: Buffer) => {
      output += data.toString();
      if (typeof pattern === 'string' ? output.includes(pattern) : pattern.test(output)) {
        cleanup();
        resolve(output);
      }
    };
    const onStderr = (data: Buffer) => {
      output += data.toString();
      if (typeof pattern === 'string' ? output.includes(pattern) : pattern.test(output)) {
        cleanup();
        resolve(output);
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      child.stdout?.off('data', onStdout);
      child.stderr?.off('data', onStderr);
    };

    child.stdout?.on('data', onStdout);
    child.stderr?.on('data', onStderr);
    child.on('error', (err) => {
      cleanup();
      reject(err);
    });
  });
}

export function getBridgePath(): string {
  return BRIDGE_PATH;
}

export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

interface SharedState {
  tempDir: string;
  projectDir: string;
  androidDeviceId: string | null;
  iosDeviceId: string | null;
}

let sharedState: SharedState | null = null;

export function setSharedState(state: SharedState): void {
  sharedState = state;
}

export function getSharedState(): SharedState {
  if (!sharedState) throw new Error('Shared state not initialized');
  return sharedState;
}

/** `it`, or a variant that skips with the reason folded into the test name. */
function skipIf(condition: boolean, reason: string): jest.It {
  if (!condition) return it;
  const skipped = ((name: string, fn?: jest.ProvidesCallback, timeout?: number) =>
    it.skip(`${name} — ${reason}`, fn, timeout)) as unknown as jest.It;
  return skipped;
}

/**
 * Skip decisions are made while the test file is being evaluated, before any
 * hook has run, so the device lookup has to be synchronous here. The shared
 * state the tests use later is still collected asynchronously in `beforeAll`.
 */
function commandSucceeds(command: string): boolean {
  try {
    execSync(command, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

const hasAndroidDevice = commandSucceeds('adb shell getprop sys.boot_completed');

const hasIOSDevice = commandSucceeds('xtool devices');

export function itIfAndroid(): jest.It {
  return skipIf(!hasAndroidDevice, 'No Android device connected');
}

export function itIfIOS(): jest.It {
  return skipIf(!hasIOSDevice, 'No iOS device connected');
}

/** The platform the template compiles against. Unreadable is a broken template, not a reason to skip. */
function templateCompileSdk(): string {
  const template = path.join(ROOT_DIR, 'cli/templates/android/app/build.gradle');
  const compileSdk = fs.readFileSync(template, 'utf-8').match(/compileSdk\s*=?\s*(\d+)/)?.[1];
  if (!compileSdk) {
    throw new Error(`Cannot read compileSdk from ${template}`);
  }
  return compileSdk;
}

/** True when the SDK has the platform the template compiles against, and Java is installed. */
function hasAndroidSdk(): boolean {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  return Boolean(
    sdk &&
      fs.existsSync(path.join(sdk, 'platforms', `android-${templateCompileSdk()}`)) &&
      commandSucceeds('java -version')
  );
}

const androidSdk = hasAndroidSdk();

export function itIfAndroidSdk(): jest.It {
  return skipIf(!androidSdk, 'No Android SDK with the template compileSdk, or no Java');
}
