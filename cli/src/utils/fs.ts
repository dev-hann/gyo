import fs from 'fs-extra';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { GyoError } from '../core/index';

export function ensureDir(dirPath: string): Promise<void> {
  return fs.ensureDir(dirPath);
}

export function copyDir(src: string, dest: string): Promise<void> {
  return fs.copy(src, dest);
}

export function pathExists(filePath: string): Promise<boolean> {
  return fs.pathExists(filePath);
}

export function readJson<T = unknown>(filePath: string): Promise<T> {
  return fs.readJson(filePath);
}

export function writeJson<T>(filePath: string, data: T): Promise<void> {
  return fs.writeJson(filePath, data, { spaces: 2 });
}

export function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

export function writeFile(filePath: string, content: string): Promise<void> {
  return fs.writeFile(filePath, content, 'utf-8');
}

export function removeDir(dirPath: string): Promise<void> {
  return fs.remove(dirPath);
}

export function getTemplatesPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const candidates = [
    path.join(__dirname, '../templates'),
    path.join(__dirname, '../../templates'),
    path.join(__dirname, '../../../templates'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new GyoError('Project templates not found. Reinstall gyo CLI.');
}
