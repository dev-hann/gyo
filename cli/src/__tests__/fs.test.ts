import * as os from 'os';
import * as path from 'path';
import fs from 'fs-extra';
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

// The functions are thin wrappers, so they are run against a real temporary
// directory: a mocked fs-extra would only answer what the test assumes.
describe('fs utils', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gyo-fs-utils-'));
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  describe('ensureDir', () => {
    it('should create a directory and its parents', async () => {
      await ensureDir(path.join(dir, 'a/b'));

      expect(await pathExists(path.join(dir, 'a/b'))).toBe(true);
    });

    it('should keep the content of an existing directory', async () => {
      await writeFile(path.join(dir, 'keep.txt'), 'content');

      await ensureDir(dir);

      expect(await readFile(path.join(dir, 'keep.txt'))).toBe('content');
    });
  });

  describe('copyDir', () => {
    it('should copy a directory recursively', async () => {
      fs.outputFileSync(path.join(dir, 'src/nested/file.txt'), 'content');

      await copyDir(path.join(dir, 'src'), path.join(dir, 'dest'));

      expect(await readFile(path.join(dir, 'dest/nested/file.txt'))).toBe('content');
    });

    it('should propagate errors for a missing source', async () => {
      await expect(copyDir(path.join(dir, 'missing'), path.join(dir, 'dest'))).rejects.toThrow();
    });
  });

  describe('pathExists', () => {
    it('should return true for an existing path', async () => {
      await writeFile(path.join(dir, 'file.txt'), 'content');

      expect(await pathExists(path.join(dir, 'file.txt'))).toBe(true);
    });

    it('should return false for a missing path', async () => {
      expect(await pathExists(path.join(dir, 'missing'))).toBe(false);
    });
  });

  describe('readJson', () => {
    it('should return the parsed content', async () => {
      await writeJson(path.join(dir, 'config.json'), { name: 'gyo', version: '1.0.0' });

      expect(await readJson(path.join(dir, 'config.json'))).toEqual({
        name: 'gyo',
        version: '1.0.0',
      });
    });

    it('should propagate parse errors', async () => {
      await writeFile(path.join(dir, 'bad.json'), '{');

      await expect(readJson(path.join(dir, 'bad.json'))).rejects.toThrow();
    });
  });

  describe('writeJson', () => {
    it('should write indented JSON', async () => {
      await writeJson(path.join(dir, 'out.json'), { key: 'value' });

      expect(await readFile(path.join(dir, 'out.json'))).toBe('{\n  "key": "value"\n}\n');
    });
  });

  describe('readFile', () => {
    it('should return the content as UTF-8', async () => {
      await fs.writeFile(path.join(dir, 'file.txt'), '안녕', 'utf-8');

      expect(await readFile(path.join(dir, 'file.txt'))).toBe('안녕');
    });
  });

  describe('writeFile', () => {
    it('should write the content as UTF-8', async () => {
      await writeFile(path.join(dir, 'file.txt'), '안녕');

      expect(await fs.readFile(path.join(dir, 'file.txt'), 'utf-8')).toBe('안녕');
    });
  });

  describe('removeDir', () => {
    it('should remove a directory recursively', async () => {
      fs.outputFileSync(path.join(dir, 'sub/file.txt'), 'content');

      await removeDir(path.join(dir, 'sub'));

      expect(await pathExists(path.join(dir, 'sub'))).toBe(false);
    });

    it('should do nothing for a missing directory', async () => {
      await removeDir(path.join(dir, 'missing'));

      expect(await pathExists(path.join(dir, 'missing'))).toBe(false);
    });
  });
});
