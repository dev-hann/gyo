export class GyoError extends Error {
  constructor(message: string, public exitCode: number = 1) {
    super(message);
    this.name = 'GyoError';
  }
}

export class DeviceNotFoundError extends GyoError {
  constructor(deviceId: string) {
    super(`Device '${deviceId}' not found`);
  }
}

export class PlatformNotFoundError extends GyoError {
  constructor(platform: string) {
    super(`Platform '${platform}' not found`);
  }
}

export class CommandNotFoundError extends GyoError {
  constructor(command: string) {
    super(`Command '${command}' not found`);
  }
}

export class ConfigNotFoundError extends GyoError {
  constructor() {
    super('gyo.config.json not found');
  }
}

export class PlatformDisabledError extends GyoError {
  constructor(platform: string) {
    super(`Platform '${platform}' is disabled in gyo.config.json`);
  }
}

export class BuildFailedError extends GyoError {
  constructor(message: string) {
    super(message);
  }
}

export class ServerStartError extends GyoError {
  constructor(message: string) {
    super(message);
  }
}

export class PluginError extends GyoError {
  constructor(message: string) {
    super(message);
  }
}

export class ProjectValidationError extends GyoError {
  constructor(message: string) {
    super(message);
  }
}

export class NpmInstallError extends GyoError {
  constructor(packageName: string, reason?: string) {
    super(reason 
      ? `Failed to install ${packageName}: ${reason}`
      : `Failed to install ${packageName}`);
  }
}

export class DirectoryExistsError extends GyoError {
  constructor(directory: string) {
    super(`Directory "${directory}" already exists`);
  }
}

export class InvalidPlatformError extends GyoError {
  constructor(platform: string, validPlatforms: string[]) {
    super(`Invalid platform: ${platform}. Valid platforms are: ${validPlatforms.join(', ')}`);
  }
}

export class TemplateNotFoundError extends GyoError {
  constructor(template: string) {
    super(`Template "${template}" not found`);
  }
}
