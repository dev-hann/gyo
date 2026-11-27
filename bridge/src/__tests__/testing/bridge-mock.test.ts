import { Bridge } from '../../index';
import { createBridgeMock } from '../../testing';
import { cleanupPlatform } from '../../testing';
import type { BridgeMock } from '../../testing';

/** The real Bridge posts on the next microtasks. */
async function posted(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('createBridgeMock', () => {
  let mock: BridgeMock;
  let bridge: Bridge;

  beforeEach(() => {
    cleanupPlatform();
    mock = createBridgeMock('app_launcher');
    bridge = new Bridge('app_launcher');
  });

  afterEach(() => {
    bridge.destroy();
    mock.restore();
  });

  it('should record what the page posts to native', async () => {
    // destroy() below rejects what is still pending: a fire-and-forget call takes note.
    bridge.invoke('list_apps').catch(() => undefined);
    bridge.invoke('open_app', { packageName: 'com.example' }).catch(() => undefined);

    await posted();

    expect(mock.requests()).toEqual([
      {
        bridgeName: 'app_launcher',
        methodName: 'list_apps',
        data: undefined,
        callbackId: expect.any(String),
      },
      {
        bridgeName: 'app_launcher',
        methodName: 'open_app',
        data: { packageName: 'com.example' },
        callbackId: expect.any(String),
      },
    ]);
  });

  it('should answer the latest request as native does on success', async () => {
    const pending = bridge.invoke<{ apps: unknown[] }>('list_apps');

    await posted();
    mock.resolve({ apps: [] });

    await expect(pending).resolves.toEqual({ apps: [] });
  });

  it('should answer a request picked among several', async () => {
    const first = bridge.invoke<string>('one');
    const second = bridge.invoke<string>('two');

    await posted();
    mock.resolve('second answer');
    mock.resolve('first answer', mock.requests()[0]);

    await expect(first).resolves.toBe('first answer');
    await expect(second).resolves.toBe('second answer');
  });

  it('should answer the latest request as native does on failure', async () => {
    const pending = bridge.invoke('open_app', { packageName: 'missing' });

    await posted();
    mock.reject('app not found');

    await expect(pending).rejects.toThrow('app not found');
  });

  it('should deliver an event to the listeners of its bridge', () => {
    const listener = jest.fn();
    bridge.listen(listener);

    mock.emitEvent({ type: 'opened' });

    expect(listener).toHaveBeenCalledWith({ type: 'opened' });
  });

  it('should say so when there is nothing to answer', () => {
    expect(() => mock.resolve({})).toThrow('The page posted nothing to native');
  });

  it('should say so when the code under test made no Bridge', () => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;

    expect(() => mock.reject('x')).toThrow('No Bridge was created');
  });

  it('should let the next test start clean', async () => {
    bridge.invoke('list_apps').catch(() => undefined);
    await posted();
    mock.restore();

    expect(mock.requests()).toEqual([]);
    expect(window.gyoBridge).toBeUndefined();
    expect(window.androidBridge).toBeUndefined();
  });
});
