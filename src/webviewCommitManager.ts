import * as vscode from 'vscode';
import { Changelist, FileItem, FileStatus } from './types';
import { GitService } from './gitService';

export class WebviewCommitManager {
  private panel: vscode.WebviewPanel | undefined;
  private gitService: GitService;
  private changelists: Changelist[] = [];
  private unversionedFiles: FileItem[] = [];

  constructor(private workspaceRoot: string) {
    this.gitService = new GitService(workspaceRoot);
    this.initializeDefaultChangelist();
  }

  private initializeDefaultChangelist() {
    const defaultChangelist: Changelist = {
      id: 'default',
      name: 'Changes',
      description: 'Default changelist',
      files: [],
      isDefault: true,
      createdAt: new Date(),
    };
    this.changelists = [defaultChangelist];
  }

  async show(): Promise<void> {
    this.panel = vscode.window.createWebviewPanel('commitManager', 'JetBrains Commit Manager', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });

    await this.loadGitStatus();
    this.panel.webview.html = this.getWebviewContent();

    this.panel.webview.onDidReceiveMessage(async (message) => {
      console.log('Received message:', message);
      switch (message.command) {
        case 'refresh':
          await this.loadGitStatus();
          this.panel!.webview.html = this.getWebviewContent();
          break;
        case 'createChangelist':
          console.log('Creating changelist:', message.name, message.description);
          await this.createChangelist(message.name, message.description);
          vscode.window.showInformationMessage(`Created changelist: ${message.name}`);
          this.panel!.webview.html = this.getWebviewContent();
          break;
        case 'deleteChangelist':
          await this.deleteChangelist(message.changelistId);
          this.panel!.webview.html = this.getWebviewContent();
          break;
        case 'moveFile':
          await this.moveFileToChangelist(message.fileId, message.targetChangelistId);
          this.panel!.webview.html = this.getWebviewContent();
          break;
        case 'toggleFileSelection':
          this.toggleFileSelection(message.fileId);
          this.panel!.webview.html = this.getWebviewContent();
          break;
        case 'selectAll':
          this.selectAllFiles();
          this.panel!.webview.html = this.getWebviewContent();
          break;
        case 'deselectAll':
          this.deselectAllFiles();
          this.panel!.webview.html = this.getWebviewContent();
          break;
        case 'commit':
          await this.commitSelectedFiles(message.message);
          break;
      }
    });
  }

  private async loadGitStatus(): Promise<void> {
    try {
      const gitFiles = await this.gitService.getStatus();
      const unversionedFiles = await this.gitService.getUnversionedFiles();

      // Reset files in changelists
      this.changelists.forEach((changelist) => {
        changelist.files = [];
      });

      // Distribute files to changelists (for now, put all in default)
      const defaultChangelist = this.changelists.find((c) => c.isDefault);
      if (defaultChangelist) {
        defaultChangelist.files = gitFiles;
      }

      this.unversionedFiles = unversionedFiles;
    } catch (error) {
      console.error('Error loading Git status:', error);
    }
  }

  private async createChangelist(name: string, description?: string): Promise<void> {
    const newChangelist: Changelist = {
      id: this.generateId(),
      name,
      description,
      files: [],
      createdAt: new Date(),
    };

    this.changelists.push(newChangelist);
  }

  private async deleteChangelist(changelistId: string): Promise<void> {
    const changelist = this.changelists.find((c) => c.id === changelistId);
    if (!changelist || changelist.isDefault) {
      return;
    }

    // Move files to default changelist
    const defaultChangelist = this.changelists.find((c) => c.isDefault);
    if (defaultChangelist && changelist.files.length > 0) {
      defaultChangelist.files.push(...changelist.files);
    }

    this.changelists = this.changelists.filter((c) => c.id !== changelistId);
  }

  private async moveFileToChangelist(fileId: string, targetChangelistId: string): Promise<void> {
    let sourceChangelist: Changelist | undefined;
    let file: FileItem | undefined;

    // Find the file in changelists
    for (const changelist of this.changelists) {
      const fileIndex = changelist.files.findIndex((f) => f.id === fileId);
      if (fileIndex !== -1) {
        sourceChangelist = changelist;
        file = changelist.files[fileIndex];
        changelist.files.splice(fileIndex, 1);
        break;
      }
    }

    // Find the file in unversioned files
    if (!file) {
      const fileIndex = this.unversionedFiles.findIndex((f) => f.id === fileId);
      if (fileIndex !== -1) {
        file = this.unversionedFiles[fileIndex];
        this.unversionedFiles.splice(fileIndex, 1);
      }
    }

    if (file) {
      // Handle special case for unversioned target
      if (targetChangelistId === 'unversioned') {
        this.unversionedFiles.push(file);
        file.changelistId = undefined;
      } else {
        const targetChangelist = this.changelists.find((c) => c.id === targetChangelistId);
        if (targetChangelist) {
          file.changelistId = targetChangelistId;
          targetChangelist.files.push(file);
        }
      }
    }
  }

  private toggleFileSelection(fileId: string): void {
    // Check in changelists
    for (const changelist of this.changelists) {
      const file = changelist.files.find((f) => f.id === fileId);
      if (file) {
        file.isSelected = !file.isSelected;
        return;
      }
    }

    // Check in unversioned files
    const file = this.unversionedFiles.find((f) => f.id === fileId);
    if (file) {
      file.isSelected = !file.isSelected;
    }
  }

  private selectAllFiles(): void {
    this.changelists.forEach((changelist) => {
      changelist.files.forEach((file) => {
        file.isSelected = true;
      });
    });

    this.unversionedFiles.forEach((file) => {
      file.isSelected = true;
    });
  }

  private deselectAllFiles(): void {
    this.changelists.forEach((changelist) => {
      changelist.files.forEach((file) => {
        file.isSelected = false;
      });
    });

    this.unversionedFiles.forEach((file) => {
      file.isSelected = false;
    });
  }

  private getSelectedFiles(): FileItem[] {
    const selectedFiles: FileItem[] = [];

    for (const changelist of this.changelists) {
      selectedFiles.push(...changelist.files.filter((f) => f.isSelected));
    }

    selectedFiles.push(...this.unversionedFiles.filter((f) => f.isSelected));

    return selectedFiles;
  }

  private async commitSelectedFiles(message: string): Promise<void> {
    const selectedFiles = this.getSelectedFiles();

    if (selectedFiles.length === 0) {
      vscode.window.showWarningMessage('No files selected for commit.');
      return;
    }

    const success = await this.gitService.commitFiles(selectedFiles, message);

    if (success) {
      vscode.window.showInformationMessage(`Successfully committed ${selectedFiles.length} file(s)`);
      await this.loadGitStatus();
      this.panel!.webview.html = this.getWebviewContent();
    }
  }

  private getWebviewContent(): string {
    const changelistsHtml = this.changelists.map((changelist) => this.renderChangelist(changelist)).join('');
    const unversionedFilesHtml = this.renderUnversionedFiles();
    const selectedFiles = this.getSelectedFiles();

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>JetBrains Commit Manager</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
          }
          
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          
          .header h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
          }
          
          .actions {
            display: flex;
            gap: 8px;
          }
          
          .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            font-size: 12px;
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
          
          .changelist {
            margin-bottom: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
          }
          
          .changelist-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          
          .changelist-title {
            font-weight: 600;
            font-size: 14px;
          }
          
          .changelist-count {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
          }
          
          .changelist-actions {
            display: flex;
            gap: 4px;
          }
          
          .file-list {
            max-height: 300px;
            overflow-y: auto;
          }
          
          .file-item {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: pointer;
            transition: background-color 0.2s;
          }
          
          .file-item:hover {
            background-color: var(--vscode-list-hoverBackground);
          }
          
          .file-item:last-child {
            border-bottom: none;
          }
          
          .file-checkbox {
            margin-right: 8px;
            width: 16px;
            height: 16px;
          }
          
          .file-icon {
            margin-right: 8px;
            width: 16px;
            height: 16px;
          }
          
          .file-name {
            flex: 1;
            font-size: 13px;
          }
          
          .file-status {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
            text-transform: uppercase;
            margin-right: 8px;
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
            font-size: 11px;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          
          .commit-section {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background-color: var(--vscode-editor-background);
            border-top: 1px solid var(--vscode-panel-border);
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          
          .commit-message {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: 13px;
          }
          
          .commit-message:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
          }
          
          .selected-count {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            white-space: nowrap;
          }
          
          .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
          }
          
          .drag-over {
            background-color: var(--vscode-list-dropBackground);
          }
          
          .file-item.dragging {
            opacity: 0.5;
            cursor: grabbing;
          }
          
          .changelist.drop-target {
            background-color: var(--vscode-list-dropBackground);
            border: 2px dashed var(--vscode-focusBorder);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>JetBrains Commit Manager</h1>
          <div class="actions">
            <button class="btn btn-secondary" onclick="refresh()">Refresh</button>
            <button class="btn btn-secondary" onclick="createChangelist()">Create Changelist</button>
            <button class="btn btn-secondary" onclick="selectAll()">Select All</button>
            <button class="btn btn-secondary" onclick="deselectAll()">Deselect All</button>
          </div>
        </div>
        
        <div class="content">
          ${changelistsHtml}
          ${unversionedFilesHtml}
        </div>
        
        <div class="commit-section">
          <div class="selected-count">
            ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''} selected
          </div>
          <input 
            type="text" 
            class="commit-message" 
            placeholder="Enter commit message..."
            id="commitMessage"
          />
          <button class="btn btn-primary" onclick="commit()" ${selectedFiles.length === 0 ? 'disabled' : ''}>
            Commit
          </button>
        </div>
        
        <script>
          const vscode = acquireVsCodeApi();
          
          function refresh() {
            vscode.postMessage({ command: 'refresh' });
          }
          
          function createChangelist() {
            console.log('createChangelist() called');
            showCreateChangelistForm();
          }
          
          function showCreateChangelistForm() {
            const existingForm = document.getElementById('changelist-form');
            if (existingForm) {
              existingForm.remove();
            }
            
            const form = document.createElement('div');
            form.id = 'changelist-form';
            form.innerHTML = \`
              <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 20px; min-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                  <h3 style="margin: 0 0 16px 0; color: var(--vscode-editor-foreground);">Create New Changelist</h3>
                  <div style="margin-bottom: 12px;">
                    <label style="display: block; margin-bottom: 4px; color: var(--vscode-editor-foreground);">Name:</label>
                    <input type="text" id="changelist-name" style="width: 100%; padding: 8px; border: 1px solid var(--vscode-input-border); border-radius: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); box-sizing: border-box;" placeholder="e.g., Feature XYZ" />
                  </div>
                  <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; color: var(--vscode-editor-foreground);">Description (optional):</label>
                    <textarea id="changelist-description" rows="3" style="width: 100%; padding: 8px; border: 1px solid var(--vscode-input-border); border-radius: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); box-sizing: border-box; resize: vertical;" placeholder="Description of what this changelist is for"></textarea>
                  </div>
                  <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button onclick="hideCreateChangelistForm()" style="padding: 8px 16px; border: 1px solid var(--vscode-button-secondaryBackground); border-radius: 4px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer;">Cancel</button>
                    <button onclick="submitCreateChangelist()" style="padding: 8px 16px; border: none; border-radius: 4px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); cursor: pointer;">Create</button>
                  </div>
                </div>
              </div>
            \`;
            
            document.body.appendChild(form);
            const nameInput = document.getElementById('changelist-name');
            nameInput.focus();
            
            // Handle keyboard shortcuts
            nameInput.addEventListener('keydown', function(e) {
              if (e.key === 'Enter') {
                submitCreateChangelist();
              } else if (e.key === 'Escape') {
                hideCreateChangelistForm();
              }
            });
            
            document.getElementById('changelist-description').addEventListener('keydown', function(e) {
              if (e.key === 'Enter' && e.ctrlKey) {
                submitCreateChangelist();
              } else if (e.key === 'Escape') {
                hideCreateChangelistForm();
              }
            });
          }
          
          function hideCreateChangelistForm() {
            const form = document.getElementById('changelist-form');
            if (form) {
              form.remove();
            }
          }
          
          function submitCreateChangelist() {
            const nameInput = document.getElementById('changelist-name');
            const descriptionInput = document.getElementById('changelist-description');
            
            const name = nameInput.value.trim();
            const description = descriptionInput.value.trim();
            
            if (!name) {
              alert('Please enter a changelist name');
              return;
            }
            
            const message = { 
              command: 'createChangelist', 
              name: name, 
              description: description || undefined
            };
            console.log('Sending message:', message);
            vscode.postMessage(message);
            
            hideCreateChangelistForm();
          }
          
          function deleteChangelist(changelistId) {
            showDeleteConfirmation(changelistId);
          }
          
          function showDeleteConfirmation(changelistId) {
            const existingForm = document.getElementById('delete-confirmation');
            if (existingForm) {
              existingForm.remove();
            }
            
            const form = document.createElement('div');
            form.id = 'delete-confirmation';
            form.innerHTML = \`
              <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 20px; min-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                  <h3 style="margin: 0 0 16px 0; color: var(--vscode-editor-foreground);">Delete Changelist</h3>
                  <p style="margin: 0 0 16px 0; color: var(--vscode-editor-foreground);">Are you sure you want to delete this changelist? Files will be moved to the default changelist.</p>
                  <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button onclick="hideDeleteConfirmation()" style="padding: 8px 16px; border: 1px solid var(--vscode-button-secondaryBackground); border-radius: 4px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer;">Cancel</button>
                    <button onclick="confirmDeleteChangelist('\${changelistId}')" style="padding: 8px 16px; border: none; border-radius: 4px; background: #f44336; color: white; cursor: pointer;">Delete</button>
                  </div>
                </div>
              </div>
            \`;
            
            document.body.appendChild(form);
          }
          
          function hideDeleteConfirmation() {
            const form = document.getElementById('delete-confirmation');
            if (form) {
              form.remove();
            }
          }
          
          function confirmDeleteChangelist(changelistId) {
            vscode.postMessage({ 
              command: 'deleteChangelist', 
              changelistId: changelistId 
            });
            hideDeleteConfirmation();
          }
          
          function moveFile(fileId) {
            showMoveFileDialog(fileId);
          }
          
          function showMoveFileDialog(fileId) {
            const changelists = ${JSON.stringify(this.changelists.map((c) => ({ id: c.id, name: c.name })))};
            const existingForm = document.getElementById('move-file-form');
            if (existingForm) {
              existingForm.remove();
            }
            
            const options = changelists.map(c => \`<option value="\${c.id}">\${c.name}</option>\`).join('');
            
            const form = document.createElement('div');
            form.id = 'move-file-form';
            form.innerHTML = \`
              <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 20px; min-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                  <h3 style="margin: 0 0 16px 0; color: var(--vscode-editor-foreground);">Move File</h3>
                  <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 4px; color: var(--vscode-editor-foreground);">Select target changelist:</label>
                    <select id="target-changelist" style="width: 100%; padding: 8px; border: 1px solid var(--vscode-input-border); border-radius: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); box-sizing: border-box;">
                      \${options}
                    </select>
                  </div>
                  <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button onclick="hideMoveFileDialog()" style="padding: 8px 16px; border: 1px solid var(--vscode-button-secondaryBackground); border-radius: 4px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer;">Cancel</button>
                    <button onclick="confirmMoveFile('\${fileId}')" style="padding: 8px 16px; border: none; border-radius: 4px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); cursor: pointer;">Move</button>
                  </div>
                </div>
              </div>
            \`;
            
            document.body.appendChild(form);
          }
          
          function hideMoveFileDialog() {
            const form = document.getElementById('move-file-form');
            if (form) {
              form.remove();
            }
          }
          
          function confirmMoveFile(fileId) {
            const targetChangelist = document.getElementById('target-changelist').value;
            if (targetChangelist) {
              vscode.postMessage({ 
                command: 'moveFile', 
                fileId: fileId, 
                targetChangelistId: targetChangelist 
              });
            }
            hideMoveFileDialog();
          }
          
          function toggleFileSelection(fileId) {
            vscode.postMessage({ 
              command: 'toggleFileSelection', 
              fileId: fileId 
            });
          }
          
          function selectAll() {
            vscode.postMessage({ command: 'selectAll' });
          }
          
          function deselectAll() {
            vscode.postMessage({ command: 'deselectAll' });
          }
          
          function commit() {
            const message = document.getElementById('commitMessage').value.trim();
            if (!message) {
              alert('Please enter a commit message');
              return;
            }
            
            vscode.postMessage({ 
              command: 'commit', 
              message: message 
            });
          }
          
          // Handle Enter key in commit message
          document.getElementById('commitMessage').addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commit();
            }
          });
          
          // Drag and Drop functionality
          let draggedElement = null;
          
          // Add drag event listeners to file items
          function setupDragAndDrop() {
            const fileItems = document.querySelectorAll('.file-item');
            const changelists = document.querySelectorAll('.changelist');
            
            fileItems.forEach(item => {
              item.setAttribute('draggable', 'true');
              
              item.addEventListener('dragstart', function(e) {
                draggedElement = this;
                this.classList.add('dragging');
                e.dataTransfer.setData('text/plain', this.querySelector('.file-name').textContent);
                e.dataTransfer.effectAllowed = 'move';
              });
              
              item.addEventListener('dragend', function(e) {
                this.classList.remove('dragging');
                draggedElement = null;
              });
            });
            
            changelists.forEach(changelist => {
              changelist.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                this.classList.add('drop-target');
              });
              
              changelist.addEventListener('dragleave', function(e) {
                if (!this.contains(e.relatedTarget)) {
                  this.classList.remove('drop-target');
                }
              });
              
              changelist.addEventListener('drop', function(e) {
                e.preventDefault();
                this.classList.remove('drop-target');
                
                if (draggedElement) {
                  const fileId = draggedElement.getAttribute('data-file-id');
                  const changelistId = this.getAttribute('data-changelist-id');
                  
                  if (fileId && changelistId) {
                    vscode.postMessage({
                      command: 'moveFile',
                      fileId: fileId,
                      targetChangelistId: changelistId
                    });
                  }
                }
              });
            });
          }
          
          // Setup drag and drop when page loads
          document.addEventListener('DOMContentLoaded', setupDragAndDrop);
          
          // Also setup after content updates
          setupDragAndDrop();
        </script>
      </body>
      </html>
    `;
  }

  private renderChangelist(changelist: Changelist): string {
    const filesHtml = changelist.files.map((file) => this.renderFile(file, changelist.id)).join('');
    const deleteButton = changelist.isDefault
      ? ''
      : `<button class="btn btn-secondary" onclick="deleteChangelist('${changelist.id}')">Delete</button>`;

    return `
      <div class="changelist" data-changelist-id="${changelist.id}">
        <div class="changelist-header">
          <div>
            <div class="changelist-title">${changelist.name}</div>
            <div class="changelist-count">${changelist.files.length} files</div>
          </div>
          <div class="changelist-actions">
            ${deleteButton}
          </div>
        </div>
        <div class="file-list">
          ${filesHtml || '<div class="empty-state">No files in this changelist</div>'}
        </div>
      </div>
    `;
  }

  private renderUnversionedFiles(): string {
    if (this.unversionedFiles.length === 0) {
      return '';
    }

    const filesHtml = this.unversionedFiles.map((file) => this.renderFile(file)).join('');

    return `
      <div class="changelist" data-changelist-id="unversioned">
        <div class="changelist-header">
          <div>
            <div class="changelist-title">Unversioned Files</div>
            <div class="changelist-count">${this.unversionedFiles.length} files</div>
          </div>
        </div>
        <div class="file-list">
          ${filesHtml}
        </div>
      </div>
    `;
  }

  private renderFile(file: FileItem, changelistId?: string): string {
    const statusClass = file.status;
    const moveButton = changelistId
      ? `<button class="btn btn-secondary" onclick="moveFile('${file.id}')">Move</button>`
      : '';

    return `
      <div class="file-item" onclick="toggleFileSelection('${file.id}')" data-file-id="${file.id}">
        <input 
          type="checkbox" 
          class="file-checkbox" 
          ${file.isSelected ? 'checked' : ''} 
          onclick="event.stopPropagation(); toggleFileSelection('${file.id}')"
        />
        <span class="file-icon">📄</span>
        <div class="file-name">${file.name}</div>
        <span class="file-status ${statusClass}">${file.status}</span>
        <div class="file-path">${file.relativePath}</div>
        ${moveButton}
      </div>
    `;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
