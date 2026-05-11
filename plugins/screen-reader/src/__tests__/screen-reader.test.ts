import { ScreenReader } from '../ScreenReader';
import type { ReadResult, FindResult } from '../types';

describe('ScreenReader', () => {
  let reader: ScreenReader;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).androidBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    reader = new ScreenReader();
  });

  afterEach(() => {
    reader.destroy();
  });

  describe('constructor', () => {
    it('should create instance with screen_reader bridge name', () => {
      expect(reader).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return false when no native bridge present', () => {
      expect(reader.isAvailable()).toBe(false);
    });

    it('should return true when Android bridge present', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(reader.isAvailable()).toBe(true);
    });
  });

  describe('read', () => {
    it('should invoke read and return screen tree', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: ReadResult = {
        root: {
          text: '',
          contentDescription: '',
          className: 'android.widget.FrameLayout',
          bounds: '[0,0][1080,2400]',
          isClickable: false,
          isEditable: false,
          children: [
            {
              text: 'Hello',
              contentDescription: '',
              className: 'android.widget.TextView',
              bounds: '[100,200][500,300]',
              isClickable: false,
              isEditable: false,
              children: [],
            },
          ],
        },
        windowName: 'MainActivity',
        packageName: 'com.example.app',
      };

      const invokeSpy = jest.spyOn(
        (reader as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await reader.read();

      expect(result).toEqual(mockResult);
      expect(result.root).not.toBeNull();
      expect(result.root!.children).toHaveLength(1);
      expect(result.root!.children[0].text).toBe('Hello');
      expect(result.packageName).toBe('com.example.app');
      expect(invokeSpy).toHaveBeenCalledWith('read');
    });

    it('should return null root when service unavailable', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: ReadResult = {
        root: null,
        windowName: '',
        packageName: '',
      };

      const invokeSpy = jest.spyOn(
        (reader as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await reader.read();

      expect(result.root).toBeNull();
      expect(result.windowName).toBe('');
      expect(result.packageName).toBe('');
    });
  });

  describe('find', () => {
    it('should invoke find with text and return matching nodes', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: FindResult = {
        nodes: [
          {
            text: 'Settings',
            contentDescription: 'Settings button',
            className: 'android.widget.Button',
            bounds: '[100,500][300,600]',
            isClickable: true,
            isEditable: false,
            children: [],
          },
        ],
        count: 1,
      };

      const invokeSpy = jest.spyOn(
        (reader as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await reader.find({ text: 'Settings' });

      expect(result).toEqual(mockResult);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].text).toBe('Settings');
      expect(result.count).toBe(1);
      expect(invokeSpy).toHaveBeenCalledWith('find', { text: 'Settings' });
    });

    it('should return empty result when no nodes found', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: FindResult = { nodes: [], count: 0 };

      const invokeSpy = jest.spyOn(
        (reader as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await reader.find({ text: 'nonexistent' });

      expect(result.nodes).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clean up bridge on destroy', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(reader.isAvailable()).toBe(true);

      reader.destroy();

      expect(reader.isAvailable()).toBe(false);
    });
  });
});
