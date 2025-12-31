import { SpawnOptions } from 'child_process';
export interface ExecResult {
    success: boolean;
    stdout: string;
    stderr: string;
    code: number | null;
}
export declare function executeCommand(command: string, args?: string[], options?: SpawnOptions): Promise<ExecResult>;
export declare function checkCommandExists(command: string): Promise<boolean>;
//# sourceMappingURL=exec.d.ts.map