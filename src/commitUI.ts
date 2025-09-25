import * as vscode from 'vscode';
import { GitService } from './gitService';
import { FileItem } from './types';

export class CommitUI {
  private webview: vscode.WebviewView | undefined;
  private gitService: GitService;
  private currentMessage: string = '';
  private selectedFilesCount: number = 0;
  private totalFilesCount: number = 0;

  constructor(private workspaceRoot: string) {
    this.gitService = new GitService(workspaceRoot);
  }

  public setWebview(webview: vscode.WebviewView) {
    this.webview = webview;
    this.webview.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };

    this.webview.webview.html = this.getWebviewContent();
    this.setupMessageHandling();
  }

  public updateFileCounts(selectedFiles: FileItem[], totalFiles: FileItem[]) {
    this.selectedFilesCount = selectedFiles.length;
    this.totalFilesCount = totalFiles.length;
    this.updateWebview();
  }

  public setCommitMessage(message: string) {
    this.currentMessage = message;
    this.updateWebview();
  }

  private getWebviewContent(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Commit UI</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
          }

          .commit-container {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            min-height: 60px;
          }

          .commit-input-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .commit-input {
            width: 100%;
            min-height: 40px;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: inherit;
            resize: vertical;
            box-sizing: border-box;
            outline: none;
          }

          .commit-input:focus {
            border-color: var(--vscode-focusBorder);
          }

          .commit-input::placeholder {
            color: var(--vscode-input-placeholderForeground);
          }

          .commit-button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid var(--vscode-button-border);
            border-radius: 4px;
            font-family: inherit;
            font-size: inherit;
            cursor: pointer;
            white-space: nowrap;
            min-width: 80px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .commit-button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }

          .commit-button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
            opacity: 0.6;
          }

          .file-count {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 2px;
          }

          .error-message {
            color: var(--vscode-errorForeground);
            font-size: 11px;
            margin-top: 4px;
            display: none;
          }
        </style>
      </head>
      <body>
        <div class="commit-container">
          <div class="commit-input-container">
            <textarea 
              id="commit-message" 
              class="commit-input" 
              placeholder="Message (press Ctrl+Enter to commit)"
              rows="2"
            >${this.currentMessage}</textarea>
            <div class="file-count" id="file-count">
              ${
                this.selectedFilesCount > 0
                  ? `${this.selectedFilesCount}/${this.totalFilesCount} files selected`
                  : 'No files selected'
              }
            </div>
            <div class="error-message" id="error-message"></div>
          </div>
          <button 
            id="commit-button" 
            class="commit-button"
            ${this.selectedFilesCount === 0 ? 'disabled' : ''}
          >
            ${this.selectedFilesCount > 0 ? `Commit (${this.selectedFilesCount})` : 'Commit'}
          </button>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          const commitInput = document.getElementById('commit-message');
          const commitButton = document.getElementById('commit-button');
          const fileCount = document.getElementById('file-count');
          const errorMessage = document.getElementById('error-message');

          // Handle commit button click
          commitButton.addEventListener('click', () => {
            const message = commitInput.value.trim();
            if (!message) {
              showError('Commit message cannot be empty');
              return;
            }
            if (${this.selectedFilesCount} === 0) {
              showError('No files selected for commit');
              return;
            }
            vscode.postMessage({
              command: 'commit',
              message: message
            });
            hideError();
          });

          // Handle Ctrl+Enter to commit
          commitInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
              commitButton.click();
            }
          });

          // Handle input changes
          commitInput.addEventListener('input', () => {
            vscode.postMessage({
              command: 'updateMessage',
              message: commitInput.value
            });
            hideError();
          });

          function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
          }

          function hideError() {
            errorMessage.style.display = 'none';
          }

          // Handle messages from extension
          window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
              case 'updateCounts':
                const selectedCount = message.selectedFiles;
                const totalCount = message.totalFiles;
                fileCount.textContent = selectedCount > 0 ? selectedCount + '/' + totalCount + ' files selected' : 'No files selected';
                commitButton.textContent = selectedCount > 0 ? 'Commit (' + selectedCount + ')' : 'Commit';
                commitButton.disabled = selectedCount === 0;
                break;
              case 'updateMessage':
                commitInput.value = message.message;
                break;
              case 'clearMessage':
                commitInput.value = '';
                break;
            }
          });
        </script>
      </body>
      </html>
    `;
  }

  private setupMessageHandling() {
    if (!this.webview) {
      return;
    }

    this.webview.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'commit':
          await this.handleCommit(message.message);
          break;
        case 'updateMessage':
          this.currentMessage = message.message;
          break;
      }
    });
  }

  private async handleCommit(message: string) {
    // This will be handled by the extension.ts file
    // We'll emit an event that the extension can listen to
    if (this.webview) {
      this.webview.webview.postMessage({
        command: 'commitRequested',
        message: message,
      });
    }
  }

  private updateWebview() {
    if (this.webview) {
      this.webview.webview.postMessage({
        command: 'updateCounts',
        selectedFiles: this.selectedFilesCount,
        totalFiles: this.totalFilesCount,
      });
    }
  }

  public clearMessage() {
    this.currentMessage = '';
    if (this.webview) {
      this.webview.webview.postMessage({
        command: 'clearMessage',
      });
    }
  }
}
