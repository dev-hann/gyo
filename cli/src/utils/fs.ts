import * as fs from 'fs-extra';
import * as path from 'path';

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

export async function copyDir(src: string, dest: string): Promise<void> {
  await fs.copy(src, dest);
}

export async function pathExists(filePath: string): Promise<boolean> {
  return await fs.pathExists(filePath);
}

export async function readJson(filePath: string): Promise<any> {
  return await fs.readJson(filePath);
}

export async function writeJson(filePath: string, data: any): Promise<void> {
  await fs.writeJson(filePath, data, { spaces: 2 });
}

export async function readFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function removeDir(dirPath: string): Promise<void> {
  await fs.remove(dirPath);
}

export function getTemplatesPath(): string {
  // In development, templates are in the project root
  // In production, they should be bundled with the CLI
  const devPath = path.join(__dirname, '../../../templates');
  const prodPath = path.join(__dirname, '../../templates');
  
  if (fs.existsSync(devPath)) {
    return devPath;
  }
  return prodPath;
}
