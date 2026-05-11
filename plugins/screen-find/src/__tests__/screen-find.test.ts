import { ScreenFind } from '../ScreenFind';
import type { FindResult } from '../types';

describe('ScreenFind', () => {
  let finder: ScreenFind;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
    delete (window as unknown as Record<string, unknown>).androidBridge;
    delete (window as unknown as Record<string, unknown>).webkit;
    finder = new ScreenFind();
  });

  afterEach(() => {
    finder.destroy();
  });

  describe('constructor', () => {
    it('should create instance with screen_find bridge name', () => {
      expect(finder).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return false when no native bridge present', () => {
      expect(finder.isAvailable()).toBe(false);
    });

    it('should return true when Android bridge present', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(finder.isAvailable()).toBe(true);
    });
  });

  describe('findByText', () => {
    it('should invoke find_by_text with text and exact params', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: FindResult = {
        elements: [
          {
            text: 'Settings',
            contentDescription: '',
            className: 'android.widget.TextView',
            bounds: '[0,100][200,150]',
            isClickable: true,
            isFocusable: true,
            isEditable: false,
            centerX: 100,
            centerY: 125,
          },
        ],
        count: 1,
      };

      const invokeSpy = jest.spyOn(
        (finder as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await finder.findByText({ text: 'Settings', exact: false });

      expect(result).toEqual(mockResult);
      expect(result.elements).toHaveLength(1);
      expect(result.count).toBe(1);
      expect(invokeSpy).toHaveBeenCalledWith('find_by_text', {
        text: 'Settings',
        exact: false,
      });
    });

    it('should return empty result when no elements found', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: FindResult = { elements: [], count: 0 };

      const invokeSpy = jest.spyOn(
        (finder as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await finder.findByText({ text: 'nonexistent', exact: true });

      expect(result.elements).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should support exact match mode', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: FindResult = {
        elements: [
          {
            text: 'OK',
            contentDescription: '',
            className: 'android.widget.Button',
            bounds: '[50,200][150,250]',
            isClickable: true,
            isFocusable: true,
            isEditable: false,
            centerX: 100,
            centerY: 225,
          },
        ],
        count: 1,
      };

      const invokeSpy = jest.spyOn(
        (finder as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await finder.findByText({ text: 'OK', exact: true });

      expect(result.count).toBe(1);
      expect(invokeSpy).toHaveBeenCalledWith('find_by_text', {
        text: 'OK',
        exact: true,
      });
    });
  });

  describe('findById', () => {
    it('should invoke find_by_id with id param', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: FindResult = {
        elements: [
          {
            text: 'Submit',
            contentDescription: 'Submit button',
            className: 'android.widget.Button',
            bounds: '[100,300][300,350]',
            isClickable: true,
            isFocusable: true,
            isEditable: false,
            centerX: 200,
            centerY: 325,
          },
        ],
        count: 1,
      };

      const invokeSpy = jest.spyOn(
        (finder as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await finder.findById({ id: 'com.example:id/submit' });

      expect(result).toEqual(mockResult);
      expect(result.elements).toHaveLength(1);
      expect(invokeSpy).toHaveBeenCalledWith('find_by_id', {
        id: 'com.example:id/submit',
      });
    });

    it('should return empty result when id not found', async () => {
      window.androidBridge = { postMessage: jest.fn() };

      const mockResult: FindResult = { elements: [], count: 0 };

      const invokeSpy = jest.spyOn(
        (finder as unknown as { bridge: { invoke: jest.Mock } }).bridge,
        'invoke'
      );
      invokeSpy.mockResolvedValue(mockResult);

      const result = await finder.findById({ id: 'com.nonexistent:id/missing' });

      expect(result.elements).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clean up bridge on destroy', () => {
      window.androidBridge = { postMessage: jest.fn() };
      expect(finder.isAvailable()).toBe(true);

      finder.destroy();

      expect(finder.isAvailable()).toBe(false);
    });
  });
});
