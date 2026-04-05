import {
  GyoError,
  PlatformNotFoundError,
  CommandNotFoundError,
  ConfigNotFoundError,
  PlatformDisabledError,
  BuildFailedError,
  ServerStartError,
  DirectoryExistsError,
  InvalidPlatformError,
} from '../core/errors';

describe('errors', () => {
  describe('GyoError', () => {
    it('should create with default exitCode', () => {
      const error = new GyoError('test');
      expect(error.message).toBe('test');
      expect(error.exitCode).toBe(1);
      expect(error.name).toBe('GyoError');
      expect(error.cause).toBeUndefined();
    });

    it('should create with custom exitCode', () => {
      const error = new GyoError('test', 42);
      expect(error.exitCode).toBe(42);
    });

    it('should create with cause', () => {
      const cause = new Error('root cause');
      const error = new GyoError('test', 1, { cause });
      expect(error.cause).toBe(cause);
    });

    it('should be instance of Error', () => {
      const error = new GyoError('test');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('PlatformNotFoundError', () => {
    it('should create with platform name', () => {
      const error = new PlatformNotFoundError('android');
      expect(error.message).toBe("Platform 'android' not found");
      expect(error).toBeInstanceOf(GyoError);
    });
  });

  describe('CommandNotFoundError', () => {
    it('should create with command name', () => {
      const error = new CommandNotFoundError('adb');
      expect(error.message).toBe("Command 'adb' not found");
      expect(error).toBeInstanceOf(GyoError);
    });
  });

  describe('ConfigNotFoundError', () => {
    it('should create with default message', () => {
      const error = new ConfigNotFoundError();
      expect(error.message).toBe('gyo.config.json not found');
      expect(error).toBeInstanceOf(GyoError);
    });
  });

  describe('PlatformDisabledError', () => {
    it('should create with platform name', () => {
      const error = new PlatformDisabledError('ios');
      expect(error.message).toBe("Platform 'ios' is disabled in gyo.config.json");
      expect(error).toBeInstanceOf(GyoError);
    });
  });

  describe('BuildFailedError', () => {
    it('should be instance of GyoError', () => {
      const error = new BuildFailedError('build failed');
      expect(error.message).toBe('build failed');
      expect(error).toBeInstanceOf(GyoError);
    });
  });

  describe('ServerStartError', () => {
    it('should be instance of GyoError', () => {
      const error = new ServerStartError('server error');
      expect(error.message).toBe('server error');
      expect(error).toBeInstanceOf(GyoError);
    });
  });

  describe('DirectoryExistsError', () => {
    it('should create with directory path', () => {
      const error = new DirectoryExistsError('/path/to/dir');
      expect(error.message).toBe('Directory "/path/to/dir" already exists');
      expect(error).toBeInstanceOf(GyoError);
    });
  });

  describe('InvalidPlatformError', () => {
    it('should create with platform and valid list', () => {
      const error = new InvalidPlatformError('windows', ['android', 'ios']);
      expect(error.message).toBe('Invalid platform: windows. Valid platforms are: android, ios');
      expect(error).toBeInstanceOf(GyoError);
    });
  });
});
