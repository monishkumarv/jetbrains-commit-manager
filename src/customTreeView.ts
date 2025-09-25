import * as vscode from 'vscode';
import { Changelist, FileItem, FileStatus } from './types';
import { GitService } from './gitService';

export class CustomTreeViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private changelists: Changelist[] = [];
  private unversionedFiles: FileItem[] = [];
  private gitService: GitService;

  constructor(workspaceRoot: string) {
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

  async refresh(): Promise<void> {
    await this.loadGitStatus();
    this._onDidChangeTreeData.fire();
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

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      // Root level - return changelists
      return this.changelists.map(
        (changelist) =>
          new ChangelistTreeItem(
            changelist,
            changelist.files.length > 0
              ? vscode.TreeItemCollapsibleState.Expanded
              : vscode.TreeItemCollapsibleState.Collapsed
          )
      );
    }

    if (element instanceof ChangelistTreeItem) {
      // Return files in this changelist
      return element.changelist.files.map((file) => new FileTreeItem(file, element.changelist.id));
    }

    return [];
  }

  // Drag and drop support - simplified for now
  // Note: Full drag and drop support requires VS Code 1.74+ and more complex implementation
  // For now, we'll use context menu actions for moving files

  async createChangelist(name: string, description?: string): Promise<void> {
    const newChangelist: Changelist = {
      id: this.generateId(),
      name,
      description,
      files: [],
      createdAt: new Date(),
    };

    this.changelists.push(newChangelist);
    this._onDidChangeTreeData.fire();
  }

  async deleteChangelist(changelistId: string): Promise<void> {
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
    this._onDidChangeTreeData.fire();
  }

  async moveFileToChangelist(fileId: string, targetChangelistId: string): Promise<void> {
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
      const targetChangelist = this.changelists.find((c) => c.id === targetChangelistId);
      if (targetChangelist) {
        file.changelistId = targetChangelistId;
        targetChangelist.files.push(file);
      }
    }

    this._onDidChangeTreeData.fire();
  }

  getSelectedFiles(): FileItem[] {
    const selectedFiles: FileItem[] = [];

    for (const changelist of this.changelists) {
      selectedFiles.push(...changelist.files.filter((f) => f.isSelected));
    }

    selectedFiles.push(...this.unversionedFiles.filter((f) => f.isSelected));

    return selectedFiles;
  }

  toggleFileSelection(fileId: string): void {
    // Check in changelists
    for (const changelist of this.changelists) {
      const file = changelist.files.find((f) => f.id === fileId);
      if (file) {
        file.isSelected = !file.isSelected;
        this._onDidChangeTreeData.fire();
        return;
      }
    }

    // Check in unversioned files
    const file = this.unversionedFiles.find((f) => f.id === fileId);
    if (file) {
      file.isSelected = !file.isSelected;
      this._onDidChangeTreeData.fire();
    }
  }

  getChangelists(): Changelist[] {
    return this.changelists;
  }

  getUnversionedFiles(): FileItem[] {
    return this.unversionedFiles;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

export class ChangelistTreeItem extends vscode.TreeItem {
  constructor(public readonly changelist: Changelist, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(changelist.name, collapsibleState);
    this.tooltip = changelist.description || changelist.name;
    this.description = `${changelist.files.length} files`;
    this.contextValue = 'changelist';
    this.iconPath = new vscode.ThemeIcon('list-tree');

    // Enable drag and drop
    this.resourceUri = vscode.Uri.parse(`changelist:${changelist.id}`);
  }
}

export class FileTreeItem extends vscode.TreeItem {
  constructor(public readonly file: FileItem, public readonly changelistId?: string) {
    super(file.name, vscode.TreeItemCollapsibleState.None);
    this.tooltip = file.path;
    this.description = this.getStatusDescription(file.status);
    this.contextValue = 'file';
    this.iconPath = this.getStatusIcon(file.status);
    this.resourceUri = vscode.Uri.file(file.path);

    // Add checkbox-like behavior
    this.command = {
      command: 'jetbrains-commit-manager.toggleFileSelection',
      title: 'Toggle Selection',
      arguments: [file.id],
    };
  }

  private getStatusDescription(status: FileStatus): string {
    switch (status) {
      case FileStatus.MODIFIED:
        return 'Modified';
      case FileStatus.ADDED:
        return 'Added';
      case FileStatus.DELETED:
        return 'Deleted';
      case FileStatus.UNTRACKED:
        return 'Untracked';
      case FileStatus.RENAMED:
        return 'Renamed';
      default:
        return '';
    }
  }

  private getStatusIcon(status: FileStatus): vscode.ThemeIcon {
    switch (status) {
      case FileStatus.MODIFIED:
        return new vscode.ThemeIcon('pencil');
      case FileStatus.ADDED:
        return new vscode.ThemeIcon('add');
      case FileStatus.DELETED:
        return new vscode.ThemeIcon('trash');
      case FileStatus.UNTRACKED:
        return new vscode.ThemeIcon('question');
      case FileStatus.RENAMED:
        return new vscode.ThemeIcon('arrow-swap');
      default:
        return new vscode.ThemeIcon('file');
    }
  }
}
