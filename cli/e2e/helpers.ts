import { execFile, spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import fs from 'fs-extra';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const ROOT_DIR = path.resolve(__dirname, '../..');
const CLI_PATH = path.join(ROOT_DIR, 'cli/dist/index.js');
const BRIDGE_PATH = path.join(ROOT_DIR, 'plugins/bridge');

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function execCLI(args: string[], options?: { cwd?: string; timeout?: number }): Promise<ExecResult> {
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

export async function exec(cmd: string, options?: { cwd?: string; timeout?: number }): Promise<ExecResult> {
  const { exec: execCmd } = await import('child_process');
  return new Promise((resolve, reject) => {
    execCmd(cmd, { cwd: options?.cwd, timeout: options?.timeout ?? 120_000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && (err as { killed?: boolean }).killed) {
        reject(new Error(`Command timed out: ${cmd}`));
        return;
      }
      resolve({ exitCode: err ? 1 : 0, stdout: stdout ?? '', stderr: stderr ?? '' });
    });
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

export function waitForOutput(child: ReturnType<typeof spawn>, pattern: string | RegExp, timeoutMs = 120_000): Promise<string> {
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

function skipIf(condition: boolean, reason: string): jest.It {
  return condition ? it.skip(reason) : it;
}

export function itIfAndroid(): jest.It {
  const state = sharedState;
  return skipIf(!state?.androidDeviceId, 'No Android device connected');
}

export function itIfIOS(): jest.It {
  const state = sharedState;
  return skipIf(!state?.iosDeviceId, 'No iOS device connected');
}
