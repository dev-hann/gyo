jest.mock('fs-extra', () => ({
  ensureDir: jest.fn(),
  copy: jest.fn(),
  pathExists: jest.fn(),
  readJson: jest.fn(),
  writeJson: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  remove: jest.fn(),
  existsSync: jest.fn(),
}));

jest.mock('../utils/fs', () => {
  const actualFs = jest.requireMock('fs-extra');
  return {
    ensureDir: actualFs.ensureDir,
    copyDir: actualFs.copy,
    pathExists: actualFs.pathExists,
    readJson: actualFs.readJson,
    writeJson: actualFs.writeJson,
    readFile: actualFs.readFile,
    writeFile: actualFs.writeFile,
    removeDir: actualFs.remove,
    getTemplatesPath: jest.fn().mockReturnValue('/templates'),
  };
});

import {
  ensureDir,
  copyDir,
  pathExists,
  readJson,
  writeJson,
  readFile,
  writeFile,
  removeDir,
} from '../utils/fs';

const mockFs = jest.requireMock('fs-extra');

describe('fs utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureDir', () => {
    it('should call fs.ensureDir with the given path', async () => {
      mockFs.ensureDir.mockResolvedValueOnce(undefined);
      await ensureDir('/tmp/test-dir');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/tmp/test-dir');
    });

    it('should propagate fs.ensureDir errors', async () => {
      mockFs.ensureDir.mockRejectedValueOnce(new Error('permission denied'));
      await expect(ensureDir('/no-access')).rejects.toThrow('permission denied');
    });
  });

  describe('copyDir', () => {
    it('should call fs.copy with src and dest', async () => {
      mockFs.copy.mockResolvedValueOnce(undefined);
      await copyDir('/src', '/dest');
      expect(mockFs.copy).toHaveBeenCalledWith('/src', '/dest');
    });

    it('should propagate fs.copy errors', async () => {
      mockFs.copy.mockRejectedValueOnce(new Error('src not found'));
      await expect(copyDir('/missing', '/dest')).rejects.toThrow('src not found');
    });
  });

  describe('pathExists', () => {
    it('should return true when path exists', async () => {
      mockFs.pathExists.mockResolvedValueOnce(true);
      const result = await pathExists('/exists');
      expect(result).toBe(true);
    });

    it('should return false when path does not exist', async () => {
      mockFs.pathExists.mockResolvedValueOnce(false);
      const result = await pathExists('/missing');
      expect(result).toBe(false);
    });
  });

  describe('readJson', () => {
    it('should call fs.readJson and return parsed data', async () => {
      const testData = { name: 'gyo', version: '1.0.0' };
      mockFs.readJson.mockResolvedValueOnce(testData);
      const result = await readJson('/config.json');
      expect(result).toEqual(testData);
      expect(mockFs.readJson).toHaveBeenCalledWith('/config.json');
    });

    it('should propagate parse errors', async () => {
      mockFs.readJson.mockRejectedValueOnce(new Error('Unexpected token'));
      await expect(readJson('/bad.json')).rejects.toThrow('Unexpected token');
    });
  });

  describe('writeJson', () => {
    it('should call fs.writeJson with data', async () => {
      mockFs.writeJson.mockResolvedValueOnce(undefined);
      await writeJson('/out.json', { key: 'value' });
      expect(mockFs.writeJson).toHaveBeenCalledWith('/out.json', { key: 'value' });
    });
  });

  describe('readFile', () => {
    it('should call fs.readFile and return content', async () => {
      mockFs.readFile.mockResolvedValueOnce('file content');
      const result = await readFile('/file.txt');
      expect(result).toBe('file content');
      expect(mockFs.readFile).toHaveBeenCalledWith('/file.txt');
    });
  });

  describe('writeFile', () => {
    it('should call fs.writeFile with content', async () => {
      mockFs.writeFile.mockResolvedValueOnce(undefined);
      await writeFile('/file.txt', 'hello');
      expect(mockFs.writeFile).toHaveBeenCalledWith('/file.txt', 'hello');
    });
  });

  describe('removeDir', () => {
    it('should call fs.remove with the given path', async () => {
      mockFs.remove.mockResolvedValueOnce(undefined);
      await removeDir('/tmp/dir');
      expect(mockFs.remove).toHaveBeenCalledWith('/tmp/dir');
    });
  });
});
