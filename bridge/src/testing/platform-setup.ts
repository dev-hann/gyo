export type Platform = 'android' | 'ios' | 'none';

export function setPlatform(platform: Platform): void {
  cleanupPlatform();

  switch (platform) {
    case 'android':
      window.androidBridge = {
        postMessage: jest.fn(),
      };
      break;
    case 'ios':
      window.webkit = {
        messageHandlers: {
          gyoBridge: {
            postMessage: jest.fn(),
          },
        },
      };
      break;
    case 'none':
      break;
  }
}

export function cleanupPlatform(): void {
  delete (window as unknown as Record<string, unknown>).androidBridge;
  delete (window as unknown as Record<string, unknown>).webkit;
  delete (window as unknown as Record<string, unknown>).gyoBridge;
}
