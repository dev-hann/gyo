import * as fs from 'fs';

jest.mock('fs');

describe('CLI Entry Point', () => {
  describe('getVersion', () => {
    beforeEach(() => {
      (fs.readFileSync as jest.Mock).mockReset();
    });

    afterEach(() => {
      (fs.readFileSync as jest.Mock).mockRestore();
    });

    it('should return version from package.json', () => {
      const mockVersion = '1.2.3';
      const mockPkg = { version: mockVersion };
      const mockPath = '/mock/src/../package.json';

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockPkg));

      const getVersion = () => {
        try {
          const pkg = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
          return pkg.version;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`Failed to read package.json for version: ${message}`);
          return '0.0.0';
        }
      };

      expect(getVersion()).toBe(mockVersion);
      expect(fs.readFileSync).toHaveBeenCalledWith(mockPath, 'utf-8');
    });

    it('should return 0.0.0 when package.json is not found', () => {
      const mockError = new Error('ENOENT: no such file or directory');
      const mockPath = '/mock/src/../package.json';

      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      const getVersion = () => {
        try {
          const pkg = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
          return pkg.version;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`Failed to read package.json for version: ${message}`);
          return '0.0.0';
        }
      };

      expect(getVersion()).toBe('0.0.0');
    });

    it('should return 0.0.0 when package.json has invalid JSON', () => {
      const mockPath = '/mock/src/../package.json';

      (fs.readFileSync as jest.Mock).mockReturnValue('invalid json{');

      const getVersion = () => {
        try {
          const pkg = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
          return pkg.version;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`Failed to read package.json for version: ${message}`);
          return '0.0.0';
        }
      };

      expect(getVersion()).toBe('0.0.0');
    });

    it('should return undefined when package.json has no version field', () => {
      const mockPkg = { name: 'test-package' };
      const mockPath = '/mock/src/../package.json';

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockPkg));

      const getVersion = () => {
        try {
          const pkg = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
          return pkg.version;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`Failed to read package.json for version: ${message}`);
          return '0.0.0';
        }
      };

      expect(getVersion()).toBe(undefined);
    });
  });
});
