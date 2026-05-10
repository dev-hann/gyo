import { createBridgeMock } from '../bridge-mock';

describe('createBridgeMock', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).gyoBridge;
  });

  it('should return mock functions', () => {
    const mock = createBridgeMock('test');

    expect(typeof mock.mockInvoke).toBe('function');
    expect(typeof mock.mockListen).toBe('function');
    expect(typeof mock.simulateEvent).toBe('function');
    expect(typeof mock.simulateResponse).toBe('function');
    expect(typeof mock.simulateError).toBe('function');
    expect(typeof mock.restore).toBe('function');
  });

  it('should track invoke calls', async () => {
    const mock = createBridgeMock('test');

    mock.mockInvoke.mockResolvedValue({ result: 'ok' });

    const result = await mock.mockInvoke('scan', { format: 'qr' });

    expect(mock.mockInvoke).toHaveBeenCalledWith('scan', { format: 'qr' });
    expect(result).toEqual({ result: 'ok' });
  });

  it('should track listen calls', () => {
    const mock = createBridgeMock('test');
    const callback = jest.fn();

    const unsubscribe = mock.mockListen(callback);

    expect(mock.mockListen).toHaveBeenCalledWith(callback);
    expect(typeof unsubscribe).toBe('function');
  });

  it('should simulate events to registered listeners', () => {
    const mock = createBridgeMock('test');
    const callback = jest.fn();

    mock.mockListen(callback);
    mock.simulateEvent({ type: 'onDetected', value: '1234' });

    expect(callback).toHaveBeenCalledWith({ type: 'onDetected', value: '1234' });
  });

  it('should not deliver events after unsubscribe', () => {
    const mock = createBridgeMock('test');
    const callback = jest.fn();

    const unsubscribe = mock.mockListen(callback);
    unsubscribe();

    mock.simulateEvent({ type: 'onDetected' });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should support multiple listeners', () => {
    const mock = createBridgeMock('test');
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    mock.mockListen(cb1);
    mock.mockListen(cb2);
    mock.simulateEvent({ value: 42 });

    expect(cb1).toHaveBeenCalledWith({ value: 42 });
    expect(cb2).toHaveBeenCalledWith({ value: 42 });
  });

  it('should clear all state on restore', async () => {
    const mock = createBridgeMock('test');

    mock.mockInvoke('method1');
    const cb = jest.fn();
    mock.mockListen(cb);

    mock.restore();

    expect(mock.mockInvoke).not.toHaveBeenCalled();
    expect(mock.mockListen).not.toHaveBeenCalled();

    mock.simulateEvent({ data: 'test' });
    expect(cb).not.toHaveBeenCalled();
  });

  it('should clean up window.gyoBridge on restore', () => {
    const mock = createBridgeMock('test');
    expect(window.gyoBridge).toBeDefined();

    mock.restore();
    expect(window.gyoBridge).toBeUndefined();
  });

  it('should set up window.gyoBridge if not present', () => {
    expect(window.gyoBridge).toBeUndefined();

    createBridgeMock('test');

    expect(window.gyoBridge).toBeDefined();
    expect(typeof window.gyoBridge?.resolve).toBe('function');
    expect(typeof window.gyoBridge?.reject).toBe('function');
    expect(typeof window.gyoBridge?.publish).toBe('function');
  });

  it('should deliver events via window.gyoBridge.publish with matching name', () => {
    const mock = createBridgeMock('barcode');
    const callback = jest.fn();

    mock.mockListen(callback);

    window.gyoBridge!.publish('barcode', { scanned: '1234' });

    expect(callback).toHaveBeenCalledWith({ scanned: '1234' });
  });

  it('should not deliver events via publish with different name', () => {
    const mock = createBridgeMock('barcode');
    const callback = jest.fn();

    mock.mockListen(callback);

    window.gyoBridge!.publish('camera', { data: 'x' });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should simulate resolve via window.gyoBridge.resolve', () => {
    const mock = createBridgeMock('test');

    window.gyoBridge!.resolve('callback-123', { data: 'response' });

    mock.restore();
  });

  it('should simulate reject via window.gyoBridge.reject', () => {
    const mock = createBridgeMock('test');

    window.gyoBridge!.reject('callback-456', 'error message');

    mock.restore();
  });
});
