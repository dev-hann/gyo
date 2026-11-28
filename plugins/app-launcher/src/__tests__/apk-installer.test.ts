import { ApkInstaller } from '../ApkInstaller';

/** What was posted to the native side, once the bridge has had a turn to send it. */
async function posted(postMessage: jest.Mock): Promise<{ methodName: string; data: unknown }> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  const raw = postMessage.mock.calls[0]?.[0] as string | undefined;
  if (raw === undefined) {
    throw new Error('nothing was posted to the native bridge');
  }
  return JSON.parse(raw);
}

describe('ApkInstaller', () => {
  let installer: ApkInstaller;
  let postMessage: jest.Mock;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).androidBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    postMessage = jest.fn();
    window.androidBridge = { postMessage };
    installer = new ApkInstaller();
  });

  afterEach(() => {
    installer.destroy();
  });

  describe('constructor', () => {
    it('should create instance with app_launcher bridge name', () => {
      expect((installer as unknown as { bridge: { getName: () => string } }).bridge.getName()).toBe(
        'app_launcher'
      );
    });
  });

  describe('isAvailable', () => {
    it('should return false when no native bridge is present', () => {
      delete (window as unknown as Record<string, unknown>).androidBridge;
      expect(installer.isAvailable()).toBe(false);
    });

    it('should return true when the Android bridge is present', () => {
      expect(installer.isAvailable()).toBe(true);
    });
  });

  describe('canInstall', () => {
    it('should ask can_install_apk and answer what native knows', async () => {
      const pending = installer.canInstall();
      const message = await posted(postMessage);

      expect(message).toMatchObject({ bridgeName: 'app_launcher', methodName: 'can_install_apk' });

      window.gyoBridge?.resolve(JSON.parse(postMessage.mock.calls[0][0]).callbackId, false);

      await expect(pending).resolves.toBe(false);
    });
  });

  describe('openInstallSettings', () => {
    it('should ask open_install_settings and tell whether it opened', async () => {
      const pending = installer.openInstallSettings();
      const message = await posted(postMessage);

      expect(message.methodName).toBe('open_install_settings');

      window.gyoBridge?.resolve(JSON.parse(postMessage.mock.calls[0][0]).callbackId, true);

      await expect(pending).resolves.toBe(true);
    });
  });

  describe('install', () => {
    it('should ask install_apk with the path of the file', async () => {
      const pending = installer.install({
        path: '/data/user/0/com.example.app/cache/downloads/app.apk',
      });
      const message = await posted(postMessage);

      expect(message).toMatchObject({
        methodName: 'install_apk',
        data: { path: '/data/user/0/com.example.app/cache/downloads/app.apk' },
      });

      window.gyoBridge?.resolve(JSON.parse(postMessage.mock.calls[0][0]).callbackId, true);

      await expect(pending).resolves.toBe(true);
    });

    it('should reject when native cannot install the file', async () => {
      const pending = installer.install({ path: '/nowhere/app.apk' });
      await posted(postMessage);

      window.gyoBridge?.reject(
        JSON.parse(postMessage.mock.calls[0][0]).callbackId,
        'No file at /nowhere/app.apk.'
      );

      await expect(pending).rejects.toThrow('No file at /nowhere/app.apk.');
    });
  });

  describe('destroy', () => {
    it('should clean up bridge on destroy', () => {
      expect(installer.isAvailable()).toBe(true);

      installer.destroy();

      expect(installer.isAvailable()).toBe(false);
    });
  });
});
