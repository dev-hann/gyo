export declare function ensureDir(dirPath: string): Promise<void>;
export declare function copyDir(src: string, dest: string): Promise<void>;
export declare function pathExists(filePath: string): Promise<boolean>;
export declare function readJson(filePath: string): Promise<any>;
export declare function writeJson(filePath: string, data: any): Promise<void>;
export declare function readFile(filePath: string): Promise<string>;
export declare function writeFile(filePath: string, content: string): Promise<void>;
export declare function removeDir(dirPath: string): Promise<void>;
export declare function getTemplatesPath(): string;
//# sourceMappingURL=fs.d.ts.map