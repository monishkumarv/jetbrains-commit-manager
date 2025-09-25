import * as vscode from 'vscode';
import { FileItem, FileStatus } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class GitService {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  async getStatus(): Promise<FileItem[]> {
    try {
      const { stdout } = await this.executeGitCommand(['status', '--porcelain']);
      const files: FileItem[] = [];

      const lines = stdout
        .trim()
        .split('\n')
        .filter((line) => line.length > 0);

      for (const line of lines) {
        const status = line.substring(0, 2);
        const path = line.substring(3);

        const fileItem: FileItem = {
          id: this.generateFileId(path),
          path: path,
          name: this.getFileName(path),
          status: this.parseStatus(status),
          isSelected: false,
          relativePath: path,
        };

        files.push(fileItem);
      }

      return files;
    } catch (error) {
      console.error('Error getting Git status:', error);
      return [];
    }
  }

  async commitFiles(files: FileItem[], message: string): Promise<boolean> {
    try {
      if (files.length === 0) {
        throw new Error('No files selected for commit');
      }

      // Stage the selected files according to their status so commit will succeed
      for (const file of files) {
        switch (file.status) {
          case FileStatus.UNTRACKED:
          case FileStatus.ADDED:
          case FileStatus.MODIFIED:
          case FileStatus.RENAMED:
            await this.executeGitCommand(['add', '--', file.path]);
            break;
          case FileStatus.DELETED:
            // Stage deletion
            await this.executeGitCommand(['rm', '--', file.path]);
            break;
          default:
            await this.executeGitCommand(['add', '--', file.path]);
        }
      }

      const filePaths = files.map((f) => f.path);
      // Commit only the selected files (limit commit to these paths even if other files are staged)
      const commitArgs = ['commit', '-m', message, '--only', '--', ...filePaths];
      await this.executeGitCommand(commitArgs);

      return true;
    } catch (error) {
      console.error('Error committing files:', error);
      vscode.window.showErrorMessage(`Failed to commit files: ${error}`);
      return false;
    }
  }

  async getUnversionedFiles(): Promise<FileItem[]> {
    try {
      const { stdout } = await this.executeGitCommand(['ls-files', '--others', '--exclude-standard']);
      const files: FileItem[] = [];

      const lines = stdout
        .trim()
        .split('\n')
        .filter((line) => line.length > 0);

      for (const line of lines) {
        const fileItem: FileItem = {
          id: this.generateFileId(line),
          path: line,
          name: this.getFileName(line),
          status: FileStatus.UNTRACKED,
          isSelected: false,
          relativePath: line,
        };

        files.push(fileItem);
      }

      return files;
    } catch (error) {
      console.error('Error getting unversioned files:', error);
      return [];
    }
  }

  async addFileToGit(filePath: string): Promise<boolean> {
    try {
      await this.executeGitCommand(['add', filePath]);
      return true;
    } catch (error) {
      console.error('Error adding file to Git:', error);
      return false;
    }
  }

  async stageFile(filePath: string): Promise<boolean> {
    try {
      await this.executeGitCommand(['add', filePath]);
      return true;
    } catch (error) {
      console.error('Error staging file:', error);
      return false;
    }
  }

  async unstageFile(filePath: string): Promise<boolean> {
    try {
      await this.executeGitCommand(['reset', 'HEAD', '--', filePath]);
      return true;
    } catch (error) {
      console.error('Error unstaging file:', error);
      return false;
    }
  }

  async isFileTracked(filePath: string): Promise<boolean> {
    try {
      const { stdout } = await this.executeGitCommand(['ls-files', filePath]);
      return stdout.trim().length > 0;
    } catch (error) {
      console.error('Error checking if file is tracked:', error);
      return false;
    }
  }

  async revertFiles(files: FileItem[]): Promise<boolean> {
    try {
      if (files.length === 0) {
        throw new Error('No files selected for revert');
      }

      const filePaths = files.map((f) => f.path);

      // First, unstage the files (reset HEAD)
      await this.executeGitCommand(['reset', 'HEAD', '--', ...filePaths]);

      // Then, revert the unstaged changes
      // Prefer disabling hooks; if that fails, fall back to normal checkout
      const hooksBypassArgs = this.getHooksBypassArgs();
      try {
        await this.executeGitCommand([...hooksBypassArgs, 'checkout', '--', ...filePaths]);
      } catch (e) {
        // Fallback without bypass if the config flag/path is not supported in the environment
        await this.executeGitCommand(['checkout', '--', ...filePaths]);
      }

      return true;
    } catch (error) {
      console.error('Error reverting files:', error);
      vscode.window.showErrorMessage(`Failed to revert files: ${error}`);
      return false;
    }
  }

  private getHooksBypassArgs(): string[] {
    // On most systems, pointing hooksPath to a non-existent dir disables hooks.
    // To be safe across platforms, create an empty temp dir and point hooksPath there.
    try {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-hooks-empty-'));
      return ['-c', `core.hooksPath=${tempDir}`];
    } catch {
      // Fallback to a commonly non-existent path; if unsupported, the caller will retry without it
      return ['-c', 'core.hooksPath=/dev/null'];
    }
  }

  private async executeGitCommand(
    args: string[],
    options?: { retryOnLock?: boolean }
  ): Promise<{ stdout: string; stderr: string }> {
    const retryOnLock = options?.retryOnLock !== false;
    try {
      return await new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        const command = `git ${args.join(' ')}`;

        exec(command, { cwd: this.workspaceRoot }, (error: any, stdout: string, stderr: string) => {
          if (error) {
            reject(new Error(stderr || String(error)));
          } else {
            resolve({ stdout, stderr });
          }
        });
      });
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      const lockPath = path.join(this.workspaceRoot, '.git', 'index.lock');
      const lockDetected =
        msg.includes('index.lock') ||
        msg.includes('Another git process seems to be running') ||
        msg.includes('unable to write new index file');

      if (retryOnLock && lockDetected && fs.existsSync(lockPath)) {
        try {
          fs.unlinkSync(lockPath);
          // Retry once without further retries to prevent loops
          return await this.executeGitCommand(args, { retryOnLock: false });
        } catch (unlinkErr) {
          // Fall through and rethrow original error
        }
      }

      throw err;
    }
  }

  private parseStatus(status: string): FileStatus {
    const x = status[0];
    const y = status[1];

    if (x === 'M' || y === 'M') {
      return FileStatus.MODIFIED;
    }
    if (x === 'A' || y === 'A') {
      return FileStatus.ADDED;
    }
    if (x === 'D' || y === 'D') {
      return FileStatus.DELETED;
    }
    if (x === 'R' || y === 'R') {
      return FileStatus.RENAMED;
    }
    if (x === '?' || y === '?') {
      return FileStatus.UNTRACKED;
    }

    return FileStatus.MODIFIED;
  }

  private getFileName(path: string): string {
    return path.split('/').pop() || path;
  }

  private generateFileId(path: string): string {
    return Buffer.from(path).toString('base64');
  }
}
