import { ScreenAction } from '../ScreenAction';

describe('ScreenAction', () => {
  let action: ScreenAction;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).androidBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    action = new ScreenAction();
  });

  afterEach(() => {
    action.destroy();
  });

  describe('constructor', () => {
    it('should create instance with screen_action bridge name', () => {
      expect(action).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return false when no native bridge present', () => {
      expect(action.isAvailable()).toBe(false);
    });

    it('should return true when Android bridge present', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(action.isAvailable()).toBe(true);
    });
  });

  describe('tap', () => {
    it('should invoke tap with coordinates', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokeSpy = jest.spyOn(
        (action as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(true);

      const result = await action.tap({ x: 100, y: 200 });

      expect(result).toBe(true);
      expect(invokeSpy).toHaveBeenCalledWith('tap', { x: 100, y: 200 });
    });

    it('should return false when tap fails', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokeSpy = jest.spyOn(
        (action as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(false);

      const result = await action.tap({ x: -1, y: -1 });

      expect(result).toBe(false);
    });
  });

  describe('type', () => {
    it('should invoke type with text', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokeSpy = jest.spyOn(
        (action as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(true);

      const result = await action.type({ text: 'hello world' });

      expect(result).toBe(true);
      expect(invokeSpy).toHaveBeenCalledWith('type', { text: 'hello world' });
    });

    it('should return false when type fails', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokeSpy = jest.spyOn(
        (action as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(false);

      const result = await action.type({ text: '' });

      expect(result).toBe(false);
    });
  });

  describe('swipe', () => {
    it('should invoke swipe with coordinates and duration', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokeSpy = jest.spyOn(
        (action as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(true);

      const result = await action.swipe({
        startX: 100,
        startY: 500,
        endX: 100,
        endY: 200,
        duration: 300,
      });

      expect(result).toBe(true);
      expect(invokeSpy).toHaveBeenCalledWith('swipe', {
        startX: 100,
        startY: 500,
        endX: 100,
        endY: 200,
        duration: 300,
      });
    });

    it('should return false when swipe fails', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokeSpy = jest.spyOn(
        (action as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(false);

      const result = await action.swipe({
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
        duration: 0,
      });

      expect(result).toBe(false);
    });
  });

  describe('globalAction', () => {
    it('should invoke global with action string', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokeSpy = jest.spyOn(
        (action as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(true);

      const result = await action.globalAction({ action: 'back' });

      expect(result).toBe(true);
      expect(invokeSpy).toHaveBeenCalledWith('global', { action: 'back' });
    });

    it('should return false when global action fails', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const invokeSpy = jest.spyOn(
        (action as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(false);

      const result = await action.globalAction({ action: 'unknown_action' });

      expect(result).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should clean up bridge on destroy', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(action.isAvailable()).toBe(true);

      action.destroy();

      expect(action.isAvailable()).toBe(false);
    });
  });
});
