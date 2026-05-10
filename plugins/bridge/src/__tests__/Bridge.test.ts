import { Bridge } from '../Bridge';

describe('Bridge', () => {
  let bridge: Bridge;

  beforeEach(() => {
    window.gyoBridge = undefined;
    window.androidBridge = undefined;
    window.webkit = undefined;
    bridge = new Bridge('test-bridge');
  });

  afterEach(() => {
    bridge.destroy();
  });

  describe('constructor', () => {
    it('should set up global bridge interface on window', () => {
      expect(window.gyoBridge).toBeDefined();
      expect(window.gyoBridge?.resolve).toBeInstanceOf(Function);
      expect(window.gyoBridge?.reject).toBeInstanceOf(Function);
      expect(window.gyoBridge?.publish).toBeInstanceOf(Function);
    });

    it('should use default timeout of 30000ms', () => {
      const b = new Bridge('default-timeout');
      expect(b.getName()).toBe('default-timeout');
      b.destroy();
    });

    it('should accept custom timeout option', () => {
      const b = new Bridge('custom-timeout', { timeout: 5000 });
      expect(b.getName()).toBe('custom-timeout');
      b.destroy();
    });
  });

  describe('getName', () => {
    it('should return the bridge name', () => {
      expect(bridge.getName()).toBe('test-bridge');
    });
  });

  describe('invoke', () => {
    it('should throw error when no native bridge is found', async () => {
      await expect(bridge.invoke('testMethod')).rejects.toThrow('No native bridge found');
    });

    it('should reject on timeout', async () => {
      const fastBridge = new Bridge('timeout-test', { timeout: 50 });

      window.androidBridge = {
        postMessage: jest.fn(),
      };

      jest.useFakeTimers();

      const promise = fastBridge.invoke('slowMethod');

      jest.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow("Bridge method 'slowMethod' timed out after 50ms");

      fastBridge.destroy();
      jest.useRealTimers();
    });

    it('should send request to Android bridge when available', async () => {
      const mockPostMessage = jest.fn();
      window.androidBridge = { postMessage: mockPostMessage };

      const invokePromise = bridge.invoke('testMethod', { key: 'value' });

      expect(mockPostMessage).toHaveBeenCalledTimes(1);

      const sentMessage = JSON.parse(mockPostMessage.mock.calls[0][0]);
      expect(sentMessage.bridgeName).toBe('test-bridge');
      expect(sentMessage.methodName).toBe('testMethod');
      expect(sentMessage.data).toEqual({ key: 'value' });
      expect(sentMessage.callbackId).toBeDefined();

      window.gyoBridge!.resolve(sentMessage.callbackId, { result: 'ok' });

      const result = await invokePromise;
      expect(result).toEqual({ result: 'ok' });
    });

    it('should send request to iOS bridge when available', async () => {
      const mockPostMessage = jest.fn();
      window.webkit = {
        messageHandlers: {
          gyoBridge: { postMessage: mockPostMessage },
        },
      };

      const invokePromise = bridge.invoke('iosMethod');

      expect(mockPostMessage).toHaveBeenCalledTimes(1);

      const sentRequest = mockPostMessage.mock.calls[0][0];
      expect(sentRequest.bridgeName).toBe('test-bridge');
      expect(sentRequest.methodName).toBe('iosMethod');
      expect(sentRequest.callbackId).toBeDefined();

      window.gyoBridge!.resolve(sentRequest.callbackId, { ios: true });

      const result = await invokePromise;
      expect(result).toEqual({ ios: true });
    });

    it('should reject when native calls reject', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokePromise = bridge.invoke('failingMethod');

      const sentMessage = JSON.parse(
        (window.androidBridge.postMessage as jest.Mock).mock.calls[0][0]
      );

      window.gyoBridge!.reject(sentMessage.callbackId, 'Native error');

      await expect(invokePromise).rejects.toThrow('Native error');
    });

    it('should clean up pending callback after resolve', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokePromise = bridge.invoke('testMethod');

      const sentMessage = JSON.parse(
        (window.androidBridge.postMessage as jest.Mock).mock.calls[0][0]
      );

      window.gyoBridge!.resolve(sentMessage.callbackId, 'data');

      await invokePromise;

      window.gyoBridge!.resolve(sentMessage.callbackId, 'data2');

      const result = await invokePromise;
      expect(result).toBe('data');
    });

    it('should generate unique callback IDs', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      bridge.invoke('method1');
      bridge.invoke('method2');

      const calls = (window.androidBridge.postMessage as jest.Mock).mock.calls;
      const id1 = JSON.parse(calls[0][0]).callbackId;
      const id2 = JSON.parse(calls[1][0]).callbackId;

      expect(id1).not.toBe(id2);
    });

    it('should prefer Android bridge over iOS bridge', async () => {
      const androidPost = jest.fn();
      const iosPost = jest.fn();

      window.androidBridge = { postMessage: androidPost };
      window.webkit = {
        messageHandlers: { gyoBridge: { postMessage: iosPost } },
      };

      const invokePromise = bridge.invoke('prefMethod');

      expect(androidPost).toHaveBeenCalledTimes(1);
      expect(iosPost).not.toHaveBeenCalled();

      const sentMessage = JSON.parse(androidPost.mock.calls[0][0]);
      window.gyoBridge!.resolve(sentMessage.callbackId, null);
      await invokePromise;
    });
  });

  describe('listen', () => {
    it('should register event listener and return unsubscribe function', () => {
      const callback = jest.fn();
      const unsubscribe = bridge.listen(callback);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });

    it('should call listener when publish is called with matching bridge name', () => {
      const callback = jest.fn();
      bridge.listen(callback);

      window.gyoBridge!.publish('test-bridge', { event: 'data' });

      expect(callback).toHaveBeenCalledWith({ event: 'data' });
    });

    it('should not call listener when publish is called with different bridge name', () => {
      const callback = jest.fn();
      bridge.listen(callback);

      window.gyoBridge!.publish('other-bridge', { event: 'data' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should stop receiving events after unsubscribe', () => {
      const callback = jest.fn();
      const unsubscribe = bridge.listen(callback);

      unsubscribe();

      window.gyoBridge!.publish('test-bridge', { event: 'data' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      bridge.listen(callback1);
      bridge.listen(callback2);

      window.gyoBridge!.publish('test-bridge', { event: 'data' });

      expect(callback1).toHaveBeenCalledWith({ event: 'data' });
      expect(callback2).toHaveBeenCalledWith({ event: 'data' });
    });
  });

  describe('destroy', () => {
    it('should clear all pending callbacks so late resolve is ignored', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokePromise = bridge.invoke('pendingMethod');

      const sentMessage = JSON.parse(
        (window.androidBridge.postMessage as jest.Mock).mock.calls[0][0]
      );

      bridge.destroy();

      window.gyoBridge!.resolve(sentMessage.callbackId, 'late-response');

      let resolved = false;
      let rejected = false;
      invokePromise.then(
        () => {
          resolved = true;
        },
        () => {
          rejected = true;
        }
      );

      await Promise.resolve();

      expect(resolved).toBe(false);
      expect(rejected).toBe(false);
    });

    it('should clear all event listeners', () => {
      const callback = jest.fn();
      bridge.listen(callback);

      bridge.destroy();

      window.gyoBridge!.publish('test-bridge', { event: 'data' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should reject invoke after destroy', async () => {
      bridge.destroy();

      await expect(bridge.invoke('anyMethod')).rejects.toThrow('Bridge has been destroyed');
    });
  });

  describe('multiple bridge instances', () => {
    it('should not overwrite existing gyoBridge', () => {
      const bridge1 = new Bridge('bridge-1');
      const bridge2 = new Bridge('bridge-2');

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      bridge1.listen(callback1);
      bridge2.listen(callback2);

      window.gyoBridge!.publish('bridge-1', { target: 1 });
      window.gyoBridge!.publish('bridge-2', { target: 2 });

      expect(callback1).toHaveBeenCalledWith({ target: 1 });
      expect(callback1).toHaveBeenCalledTimes(1);

      expect(callback2).toHaveBeenCalledWith({ target: 2 });
      expect(callback2).toHaveBeenCalledTimes(1);

      bridge1.destroy();
      bridge2.destroy();
    });
  });
});
