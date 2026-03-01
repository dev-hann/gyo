export class GyoError extends Error {
  constructor(
    message: string,
    public exitCode: number = 1
  ) {
    super(message);
    this.name = 'GyoError';
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

export class BuildFailedError extends GyoError {}

export class ServerStartError extends GyoError {}

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
