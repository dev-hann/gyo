import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import fs from 'fs-extra';
import { WebServerService } from '../services/web-server.service';
import { signalProcessTree } from '../utils/exec';
import { silenceLogger } from './helpers/logger';

// Mocks cannot show what a pipe does: this starts a real server, through the
// real `net` and `child_process`, and stops it the way the CLI stops one.

/** A port nothing listens on, as far as the OS says now. */
async function freePort(): Promise<number> {
  const probe = net.createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address() as net.AddressInfo;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

/** A web app with its dependencies in place, so that none get installed. */
function webApp(): string {
  const webPath = fs.mkdtempSync(path.join(os.tmpdir(), 'gyo-server-'));
  fs.outputJsonSync(path.join(webPath, 'package.json'), { name: 'web', private: true });
  fs.ensureDirSync(path.join(webPath, 'node_modules'));
  return webPath;
}

/** Resolves once `condition` holds; rejects after `ms`, instead of leaving a test hanging. */
function until(condition: () => boolean, ms: number): Promise<void> {
  const started = Date.now();
  return new Promise<void>((resolve, reject) => {
    const check = (): void => {
      if (condition()) {
        resolve();
      } else if (Date.now() - started > ms) {
        reject(new Error('Still waiting after ' + ms + ' ms'));
      } else {
        setTimeout(check, 20);
      }
    };
    check();
  });
}

describe('WebServerService with a real server', () => {
  let webPath: string;

  beforeEach(() => {
    silenceLogger();
    webPath = webApp();
  });

  afterEach(() => {
    fs.removeSync(webPath);
  });

  it("should take the server's output, so that one printing more than a pipe holds is not held up by it", async () => {
    const port = await freePort();
    const written = path.join(webPath, 'written');
    // Four times what a pipe buffers, and the server waits for the write to be over before it
    // listens. The command goes through a shell: no double quotes inside it.
    const script = `process.stdout.write(Buffer.alloc(256 * 1024, 'x'), () => {
      require('fs').writeFileSync('${written}', '');
      require('net').createServer().listen(${port}, '127.0.0.1');
    });`;
    const giveUp = new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error('The server never opened its port')), 5000).unref();
    });

    const handle = await Promise.race([
      new WebServerService().start({
        webPath,
        port,
        startCommand: `node -e "${script}"`,
        advertiseHost: '127.0.0.1',
      }),
      giveUp,
    ]);

    try {
      expect(handle.url).toBe(`http://127.0.0.1:${port}`);
      // The write is over: nothing of the output is kept waiting.
      await until(() => fs.existsSync(written), 1500);
    } finally {
      signalProcessTree(handle.process, 'SIGKILL');
    }
  });
});
