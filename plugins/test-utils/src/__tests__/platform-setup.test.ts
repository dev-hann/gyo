import { setPlatform, cleanupPlatform } from '../platform-setup';

describe('setPlatform', () => {
  afterEach(() => {
    cleanupPlatform();
  });

  it('should set up Android bridge environment', () => {
    setPlatform('android');

    expect(window.androidBridge).toBeDefined();
    expect(typeof window.androidBridge?.postMessage).toBe('function');
    expect(window.webkit).toBeUndefined();
  });

  it('should set up iOS bridge environment', () => {
    setPlatform('ios');

    expect(window.androidBridge).toBeUndefined();
    expect(window.webkit).toBeDefined();
    expect(typeof window.webkit?.messageHandlers?.gyoBridge?.postMessage).toBe('function');
  });

  it('should clear both platforms for none', () => {
    setPlatform('android');
    setPlatform('none');

    expect(window.androidBridge).toBeUndefined();
    expect(window.webkit).toBeUndefined();
  });

  it('should switch from Android to iOS cleanly', () => {
    setPlatform('android');
    expect(window.androidBridge).toBeDefined();

    setPlatform('ios');
    expect(window.androidBridge).toBeUndefined();
    expect(window.webkit).toBeDefined();
  });

  it('should switch from iOS to Android cleanly', () => {
    setPlatform('ios');
    expect(window.webkit).toBeDefined();

    setPlatform('android');
    expect(window.androidBridge).toBeDefined();
    expect(window.webkit).toBeUndefined();
  });
});

describe('cleanupPlatform', () => {
  it('should remove all platform interfaces', () => {
    setPlatform('android');

    cleanupPlatform();

    expect(window.androidBridge).toBeUndefined();
    expect(window.webkit).toBeUndefined();
  });

  it('should also clean up window.gyoBridge', () => {
    window.gyoBridge = {
      resolve: jest.fn(),
      reject: jest.fn(),
      publish: jest.fn(),
    };

    cleanupPlatform();

    expect(window.gyoBridge).toBeUndefined();
  });

  it('should be idempotent', () => {
    cleanupPlatform();
    cleanupPlatform();
  });
});
