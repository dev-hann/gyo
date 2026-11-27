import {
  GyoError,
  PlatformNotFoundError,
  ToolRequiredError,
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
    it('should name the platform and the way out', () => {
      const error = new PlatformNotFoundError('android', '/project');
      expect(error.message).toBe(
        "Platform 'android' not found in /project. " +
          "Run 'gyo create' to initialize the project, or run gyo from the project directory."
      );
      expect(error).toBeInstanceOf(GyoError);
    });
  });

  describe('PlatformDisabledError', () => {
    it('should name the platform and the way to enable it', () => {
      const error = new PlatformDisabledError('ios');
      expect(error.message).toBe(
        "Platform 'ios' is disabled in gyo.config.json. " +
          'Enable it: gyo config set platforms.ios.enabled true'
      );
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

  describe('ToolRequiredError', () => {
    it('should create with tool name and install hint', () => {
      const error = new ToolRequiredError('adb', 'Install Android SDK');
      expect(error.message).toBe("Required tool 'adb' not found. Install Android SDK");
      expect(error).toBeInstanceOf(GyoError);
    });
  });

  describe('DirectoryExistsError', () => {
    it('should create with directory path', () => {
      const error = new DirectoryExistsError('/path/to/dir');
      expect(error.message).toBe('Directory "/path/to/dir" already exists');
      expect(error).toBeInstanceOf(GyoError);
    });

    it('should include hint when fullPath is provided', () => {
      const error = new DirectoryExistsError('my-app', '/full/path/to/my-app');
      expect(error.message).toBe(
        'Directory "my-app" already exists. Remove it or use a different project name.'
      );
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
