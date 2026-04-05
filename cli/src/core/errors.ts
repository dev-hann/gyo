export class GyoError extends Error {
  public readonly cause?: unknown;
  constructor(
    message: string,
    public exitCode: number = 1,
    errorOptions?: { cause: unknown }
  ) {
    super(message);
    this.name = 'GyoError';
    this.cause = errorOptions?.cause;
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

export class ToolRequiredError extends GyoError {
  constructor(tool: string, installHint: string) {
    super(`Required tool '${tool}' not found. ${installHint}`);
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
  constructor(directory: string, fullPath?: string) {
    const hint = fullPath ? `. Remove it or use a different project name.` : '';
    super(`Directory "${directory}" already exists${hint}`);
  }
}

export class InvalidPlatformError extends GyoError {
  constructor(platform: string, validPlatforms: string[]) {
    super(`Invalid platform: ${platform}. Valid platforms are: ${validPlatforms.join(', ')}`);
  }
}
