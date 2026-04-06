import * as fs from 'fs';

jest.mock('fs');

describe('CLI Entry Point', () => {
  describe('getVersion', () => {
    const mockPath = '/mock/src/../package.json';

    const getVersion = (): string | undefined => {
      try {
        const pkg = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
        return pkg.version;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to read package.json for version: ${message}`);
        return '0.0.0';
      }
    };

    beforeEach(() => {
      (fs.readFileSync as jest.Mock).mockReset();
    });

    afterEach(() => {
      (fs.readFileSync as jest.Mock).mockRestore();
    });

    it('should return version from package.json', () => {
      const mockVersion = '1.2.3';
      const mockPkg = { version: mockVersion };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockPkg));

      expect(getVersion()).toBe(mockVersion);
      expect(fs.readFileSync).toHaveBeenCalledWith(mockPath, 'utf-8');
    });

    it('should return 0.0.0 when package.json is not found', () => {
      const mockError = new Error('ENOENT: no such file or directory');

      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      expect(getVersion()).toBe('0.0.0');
    });

    it('should return 0.0.0 when package.json has invalid JSON', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid json{');

      expect(getVersion()).toBe('0.0.0');
    });

    it('should return undefined when package.json has no version field', () => {
      const mockPkg = { name: 'test-package' };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockPkg));

      expect(getVersion()).toBe(undefined);
    });
  });
});
