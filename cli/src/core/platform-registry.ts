import type { Platform } from './types';

export interface PlatformDefinition {
  name: Platform;
  buildCommandClass: new () => {
    setOptions: (opts: unknown) => void;
    runDirectly: () => Promise<void>;
  };
  runCommandClass: new () => {
    setOptions: (opts: unknown) => void;
    runDirectly: () => Promise<void>;
  };
}

class PlatformRegistry {
  private platforms: Map<Platform, PlatformDefinition> = new Map();

  register(definition: PlatformDefinition): void {
    this.platforms.set(definition.name, definition);
  }

  get(name: Platform): PlatformDefinition | undefined {
    return this.platforms.get(name);
  }

  getAll(): PlatformDefinition[] {
    return Array.from(this.platforms.values());
  }

  getNames(): Platform[] {
    return Array.from(this.platforms.keys());
  }

  has(name: Platform): boolean {
    return this.platforms.has(name);
  }
}

export const platformRegistry = new PlatformRegistry();
