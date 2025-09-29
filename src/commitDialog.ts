import * as vscode from 'vscode';
import { FileItem } from './types';

export class CommitDialog {
  private panel: vscode.WebviewPanel | undefined;
  private resolvePromise: ((value: { message: string; files: FileItem[]; amend: boolean } | undefined) => void) | undefined;

  constructor(private files: FileItem[]) {}

  async show(): Promise<{ message: string; files: FileItem[]; amend: boolean } | undefined> {
    this.panel = vscode.window.createWebviewPanel('commitDialog', 'Commit Changes', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });

    this.panel.webview.html = this.getWebviewContent();

    this.panel.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case 'commit':
          if (this.resolvePromise) {
            this.resolvePromise({
              message: message.message,
              files: this.files,
              amend: message.amend === true,
            });
          }
          this.panel?.dispose();
          break;
        case 'cancel':
          if (this.resolvePromise) {
            this.resolvePromise(undefined);
          }
          this.panel?.dispose();
          break;
      }
    });

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  private getWebviewContent(): string {
    const fileList = this.files
      .map(
        (file) => `
      <div class="file-item">
        <span class="file-name">${file.name}</span>
        <span class="file-status ${file.status}">${file.status}</span>
        <span class="file-path">${file.relativePath}</span>
      </div>
    `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Commit Changes</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          
          .container {
            max-width: 800px;
            margin: 0 auto;
          }
          
          .header {
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          
          .header h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
          }
          
          .commit-message-section {
            margin-bottom: 20px;
          }
          
          .commit-message-section label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
          }
          
          .commit-message-input {
            width: 100%;
            min-height: 80px;
            padding: 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: 14px;
            resize: vertical;
            box-sizing: border-box;
          }
          
          .commit-message-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
          }
          
          .files-section {
            margin-bottom: 20px;
          }
          
          .files-section h3 {
            margin: 0 0 12px 0;
            font-size: 14px;
            font-weight: 600;
          }
          
          .files-list {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            max-height: 300px;
            overflow-y: auto;
          }
          
          .file-item {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 13px;
          }
          
          .file-item:last-child {
            border-bottom: none;
          }
          
          .file-name {
            font-weight: 500;
            margin-right: 12px;
            min-width: 150px;
          }
          
          .file-status {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
            text-transform: uppercase;
            margin-right: 12px;
            min-width: 60px;
            text-align: center;
          }
          
          .file-status.modified {
            background-color: #ffd700;
            color: #000;
          }
          
          .file-status.added {
            background-color: #4caf50;
            color: white;
          }
          
          .file-status.deleted {
            background-color: #f44336;
            color: white;
          }
          
          .file-status.untracked {
            background-color: #9e9e9e;
            color: white;
          }
          
          .file-status.renamed {
            background-color: #2196f3;
            color: white;
          }
          
          .file-path {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
          }
          
          .actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
          }
          
          .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          
          .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
          }
          
          .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          
          .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
          }
          
          .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
          }
          
          .summary {
            margin-bottom: 16px;
            padding: 12px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Commit Changes</h1>
          </div>
          
          <div class="summary">
            <strong>${this.files.length}</strong> file${this.files.length !== 1 ? 's' : ''} selected for commit
          </div>
          
          <div class="commit-message-section">
            <label for="commit-message">Commit Message:</label>
            <textarea 
              id="commit-message" 
              class="commit-message-input" 
              placeholder="Enter your commit message here..."
              autofocus
            ></textarea>
          </div>
          
          <div class="files-section">
            <h3>Files to Commit:</h3>
            <div class="files-list">
              ${fileList}
            </div>
          </div>
          
          <div class="actions">
            <label style="display:flex;align-items:center;gap:6px;margin-right:auto;">
              <input type="checkbox" id="amend-checkbox" /> Amend last commit
            </label>
            <button class="btn btn-secondary" onclick="cancel()">Cancel</button>
            <button class="btn btn-primary" onclick="commit()">Commit</button>
          </div>
        </div>
        
        <script>
          const vscode = acquireVsCodeApi();
          
          function commit() {
            const message = document.getElementById('commit-message').value.trim();
            const amend = document.getElementById('amend-checkbox').checked === true;
            if (!message) {
              alert('Please enter a commit message');
              return;
            }
            
            vscode.postMessage({
              command: 'commit',
              message: message,
              amend: amend
            });
          }
          
          function cancel() {
            vscode.postMessage({
              command: 'cancel'
            });
          }
          
          // Handle Enter key in textarea
          document.getElementById('commit-message').addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.ctrlKey) {
              commit();
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}
