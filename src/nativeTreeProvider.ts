import * as vscode from 'vscode';
import * as path from 'path';
import { Changelist, FileItem, FileStatus } from './types';
import { GitService } from './gitService';

export class ChangelistTreeItem extends vscode.TreeItem {
  constructor(public readonly changelist: Changelist, public readonly collapsibleState: vscode.TreeItemCollapsibleState) {
    super(changelist.name, collapsibleState);
    this.tooltip = changelist.description || changelist.name;
    this.description = `${changelist.files.length} files`;
    this.contextValue = changelist.isDefault ? 'defaultChangelist' : 'changelist';
    this.iconPath = undefined; // Remove prefix icons from changelists

    // Add checkbox support for changelist selection
    this.updateCheckboxState();
  }

  updateCheckboxState(): void {
    this.checkboxState = this.getChangelistCheckboxState();
  }

  private getChangelistCheckboxState(): vscode.TreeItemCheckboxState {
    if (this.changelist.files.length === 0) {
      return vscode.TreeItemCheckboxState.Unchecked;
    }

    const selectedFiles = this.changelist.files.filter((file) => file.isSelected);
    const totalFiles = this.changelist.files.length;

    if (selectedFiles.length === 0) {
      return vscode.TreeItemCheckboxState.Unchecked;
    } else if (selectedFiles.length === totalFiles) {
      return vscode.TreeItemCheckboxState.Checked;
    } else {
      // For partial selection, we'll use unchecked since VS Code doesn't have a partial state
      return vscode.TreeItemCheckboxState.Unchecked;
    }
  }
}

export class FileTreeItem extends vscode.TreeItem {
  constructor(public readonly file: FileItem, public readonly workspaceRoot: string, public readonly changelistId?: string) {
    super(file.name, vscode.TreeItemCollapsibleState.None);
    this.tooltip = file.path;
    this.description = file.path; // Show relative project path instead of status
    this.contextValue = 'file';
    this.iconPath = undefined; // Remove prefix icons

    // Resolve the file path relative to workspace root
    const fullPath = path.join(workspaceRoot, file.path);
    this.resourceUri = vscode.Uri.file(fullPath);

    // Add checkbox behavior - use checkboxState for native checkboxes
    this.checkboxState = file.isSelected ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;

    // Add command to open diff on click
    this.command = {
      command: 'jetbrains-commit-manager.openDiff',
      title: 'Open Diff',
      arguments: [this.resourceUri],
    };
  }
}

export class UnversionedSectionTreeItem extends vscode.TreeItem {
  constructor(public readonly unversionedFiles: FileItem[], collapsibleState: vscode.TreeItemCollapsibleState) {
    super('Unversioned Files', collapsibleState);
    this.contextValue = 'unversionedSection';
    this.iconPath = undefined; // Remove prefix icon from unversioned files section
    this.description = `${unversionedFiles.length} files`;

    // Add checkbox support for unversioned files section
    this.updateCheckboxState();
  }

  updateCheckboxState(): void {
    this.checkboxState = this.getUnversionedCheckboxState();
  }

  private getUnversionedCheckboxState(): vscode.TreeItemCheckboxState {
    if (this.unversionedFiles.length === 0) {
      return vscode.TreeItemCheckboxState.Unchecked;
    }

    const selectedFiles = this.unversionedFiles.filter((file) => file.isSelected);
    const totalFiles = this.unversionedFiles.length;

    if (selectedFiles.length === 0) {
      return vscode.TreeItemCheckboxState.Unchecked;
    } else if (selectedFiles.length === totalFiles) {
      return vscode.TreeItemCheckboxState.Checked;
    } else {
      // For partial selection, we'll use unchecked since VS Code doesn't have a partial state
      return vscode.TreeItemCheckboxState.Unchecked;
    }
  }
}

export class NativeTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.TreeDragAndDropController<vscode.TreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private _onForceExpand: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  readonly onForceExpand: vscode.Event<void> = this._onForceExpand.event;

  private _onChangelistCreated: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
  readonly onChangelistCreated: vscode.Event<string> = this._onChangelistCreated.event;

  private _onChangelistAutoExpand: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
  readonly onChangelistAutoExpand: vscode.Event<string> = this._onChangelistAutoExpand.event;

  // Drag and drop support
  readonly dropMimeTypes = [
    'application/vnd.code.tree.jetbrains-commit-manager',
    'application/vnd.code.tree.jetbrains-commit-manager.changelist',
  ];
  readonly dragMimeTypes = [
    'application/vnd.code.tree.jetbrains-commit-manager',
    'application/vnd.code.tree.jetbrains-commit-manager.changelist',
  ];

  private changelists: Changelist[] = [];
  private unversionedFiles: FileItem[] = [];
  private unversionedFilesExpanded: boolean = true; // Track unversioned files section expansion
  private gitService: GitService;
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
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
      isExpanded: false, // Start collapsed to match VS Code's default behavior
      createdAt: new Date(),
    };
    this.changelists = [defaultChangelist];
  }

  async refresh(): Promise<void> {
    await this.loadGitStatus();
    this._onDidChangeTreeData.fire();
  }

  // Removed expand all functionality

  collapseAll(): void {
    // Force all changelists to be collapsed by updating their collapsible state
    this.changelists.forEach((changelist) => {
      changelist.isExpanded = false;
    });

    // Also collapse unversioned files section
    this.unversionedFilesExpanded = false;

    // Fire tree data change to refresh the view with collapsed state
    this._onDidChangeTreeData.fire();
  }

  private async loadGitStatus(): Promise<void> {
    try {
      const gitFiles = await this.gitService.getStatus();
      const unversionedFiles = await this.gitService.getUnversionedFiles();

      // Preserve selection states and changelist assignments for all changelists
      const selectionMap = new Map<string, boolean>();
      const changelistAssignmentMap = new Map<string, string>();

      // Collect all current selection states and changelist assignments
      for (const changelist of this.changelists) {
        for (const file of changelist.files) {
          selectionMap.set(file.id, file.isSelected);
          changelistAssignmentMap.set(file.id, changelist.id);
        }
      }

      // Also collect selection states from unversioned files
      for (const file of this.unversionedFiles) {
        selectionMap.set(file.id, file.isSelected);
      }

      // Clear all changelists
      for (const changelist of this.changelists) {
        changelist.files = [];
      }

      // Distribute files to their assigned changelists
      gitFiles.forEach((file) => {
        // Restore selection state if it was previously selected
        if (selectionMap.has(file.id)) {
          file.isSelected = selectionMap.get(file.id)!;
        }

        // Only add files that are already tracked by Git
        if (file.status !== FileStatus.UNTRACKED) {
          const assignedChangelistId = changelistAssignmentMap.get(file.id);

          if (assignedChangelistId) {
            // File was previously assigned to a specific changelist
            const targetChangelist = this.changelists.find((c) => c.id === assignedChangelistId);
            if (targetChangelist) {
              file.changelistId = targetChangelist.id;
              targetChangelist.files.push(file);
            }
          } else {
            // New file - add to default changelist
            const defaultChangelist = this.changelists.find((c) => c.isDefault);
            if (defaultChangelist) {
              file.changelistId = defaultChangelist.id;
              defaultChangelist.files.push(file);
            }
          }
        }
      });

      // Restore selection states for unversioned files
      this.unversionedFiles = unversionedFiles.map((file) => {
        if (selectionMap.has(file.id)) {
          file.isSelected = selectionMap.get(file.id)!;
        }
        return file;
      });
    } catch (error) {
      console.error('Error loading Git status:', error);
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getParent(element: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem> {
    // Root items (changelists and unversioned section) have no parent
    if (element instanceof ChangelistTreeItem || element instanceof UnversionedSectionTreeItem) {
      return null;
    }

    // File items belong to their changelist
    if (element instanceof FileTreeItem && element.changelistId) {
      const changelist = this.changelists.find((c) => c.id === element.changelistId);
      if (changelist) {
        return new ChangelistTreeItem(changelist, vscode.TreeItemCollapsibleState.Expanded);
      }
    }

    // Unversioned files belong to the unversioned section
    if (element instanceof FileTreeItem && !element.changelistId) {
      return new UnversionedSectionTreeItem(this.unversionedFiles, vscode.TreeItemCollapsibleState.Expanded);
    }

    return null;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      // Root level - return only changelists and unversioned files section
      const items: vscode.TreeItem[] = [];

      // Add changelists
      this.changelists.forEach((changelist) => {
        let collapsibleState: vscode.TreeItemCollapsibleState;

        if (changelist.files.length === 0) {
          collapsibleState = vscode.TreeItemCollapsibleState.None;
        } else if (changelist.isExpanded === true) {
          collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        } else if (changelist.isExpanded === false) {
          collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        } else {
          // Default behavior - expand if has files
          collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        }

        items.push(new ChangelistTreeItem(changelist, collapsibleState));
      });

      // Add unversioned files section if there are any
      if (this.unversionedFiles.length > 0) {
        const collapsibleState = this.unversionedFilesExpanded
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed;
        const unversionedSection = new UnversionedSectionTreeItem(this.unversionedFiles, collapsibleState);
        items.push(unversionedSection);
      }

      return items;
    }

    if (element instanceof ChangelistTreeItem) {
      // Return files in this changelist
      return element.changelist.files.map((file) => new FileTreeItem(file, this.workspaceRoot, element.changelist.id));
    }

    if (element instanceof UnversionedSectionTreeItem) {
      // Return unversioned files
      return this.unversionedFiles.map((file) => new FileTreeItem(file, this.workspaceRoot));
    }

    return [];
  }

  // Handle checkbox state changes
  async onDidChangeCheckboxState(event: vscode.TreeCheckboxChangeEvent<vscode.TreeItem>): Promise<void> {
    for (const [item, checkboxState] of event.items) {
      if (item instanceof FileTreeItem) {
        const isChecked = checkboxState === vscode.TreeItemCheckboxState.Checked;
        this.toggleFileSelection(item.file.id, isChecked);
      } else if (item instanceof ChangelistTreeItem) {
        const isChecked = checkboxState === vscode.TreeItemCheckboxState.Checked;
        this.toggleChangelistSelection(item.changelist.id, isChecked);
      } else if (item instanceof UnversionedSectionTreeItem) {
        const isChecked = checkboxState === vscode.TreeItemCheckboxState.Checked;
        this.toggleUnversionedSelection(isChecked);
      }
    }
    this._onDidChangeTreeData.fire();
  }

  async createChangelist(name: string): Promise<void> {
    const newChangelist: Changelist = {
      id: this.generateId(),
      name,
      files: [],
      isExpanded: true, // Start expanded by default for new changelists
      createdAt: new Date(),
    };

    this.changelists.push(newChangelist);
    this._onDidChangeTreeData.fire();

    // Emit event that a new changelist was created
    this._onChangelistCreated.fire(newChangelist.id);
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

  async renameChangelist(changelistId: string, newName: string): Promise<void> {
    const changelist = this.changelists.find((c) => c.id === changelistId);
    if (!changelist) {
      return;
    }

    // Check if the new name already exists
    const existingChangelist = this.changelists.find((c) => c.name === newName && c.id !== changelistId);
    if (existingChangelist) {
      throw new Error(`A changelist with the name "${newName}" already exists`);
    }

    changelist.name = newName;
    this._onDidChangeTreeData.fire();
  }

  async moveChangelistFiles(sourceChangelistId: string, targetChangelistId: string): Promise<void> {
    const sourceChangelist = this.changelists.find((c) => c.id === sourceChangelistId);
    const targetChangelist = this.changelists.find((c) => c.id === targetChangelistId);

    if (!sourceChangelist || !targetChangelist) {
      return;
    }

    // Move all files from source to target
    const filesToMove = [...sourceChangelist.files];
    sourceChangelist.files = [];

    // Update changelistId for all moved files
    filesToMove.forEach((file) => {
      file.changelistId = targetChangelistId;
    });

    // Add files to target changelist
    targetChangelist.files.push(...filesToMove);

    // Auto-expand the target changelist to show the moved files
    targetChangelist.isExpanded = true;

    this._onDidChangeTreeData.fire();
  }

  async moveFileToChangelist(fileId: string, targetChangelistId: string): Promise<void> {
    let sourceChangelist: Changelist | undefined;
    let file: FileItem | undefined;
    let wasUntracked = false;

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
        wasUntracked = true;
      }
    }

    if (file) {
      const targetChangelist = this.changelists.find((c) => c.id === targetChangelistId);
      if (targetChangelist) {
        // If the file was untracked, add it to Git tracking
        if (wasUntracked) {
          try {
            await this.gitService.addFileToGit(file.path);
            // Update the file status to ADDED since it's now tracked
            file.status = FileStatus.ADDED;
          } catch (error) {
            console.error('Error adding file to Git:', error);
            // If adding to Git fails, put the file back in unversioned files
            this.unversionedFiles.push(file);
            this._onDidChangeTreeData.fire();
            return;
          }
        }

        file.changelistId = targetChangelistId;
        targetChangelist.files.push(file);

        // Auto-expand the target changelist to show the moved file
        targetChangelist.isExpanded = true;

        // Emit event to force visual expansion
        this._onChangelistAutoExpand.fire(targetChangelistId);
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

  toggleFileSelection(fileId: string, isSelected?: boolean): void {
    // Check in changelists
    for (const changelist of this.changelists) {
      const file = changelist.files.find((f) => f.id === fileId);
      if (file) {
        file.isSelected = isSelected !== undefined ? isSelected : !file.isSelected;
        return;
      }
    }

    // Check in unversioned files
    const file = this.unversionedFiles.find((f) => f.id === fileId);
    if (file) {
      file.isSelected = isSelected !== undefined ? isSelected : !file.isSelected;
    }
  }

  toggleChangelistSelection(changelistId: string, isSelected: boolean): void {
    const changelist = this.changelists.find((c) => c.id === changelistId);
    if (changelist) {
      // Select/deselect all files in the changelist
      changelist.files.forEach((file) => {
        file.isSelected = isSelected;
      });

      // Trigger tree refresh to update checkbox states
      this._onDidChangeTreeData.fire();
    }
  }

  toggleUnversionedSelection(isSelected: boolean): void {
    // Select/deselect all unversioned files
    this.unversionedFiles.forEach((file) => {
      file.isSelected = isSelected;
    });

    // Trigger tree refresh to update checkbox states
    this._onDidChangeTreeData.fire();
  }

  selectAllFiles(): void {
    this.changelists.forEach((changelist) => {
      changelist.files.forEach((file) => {
        file.isSelected = true;
      });
    });

    this.unversionedFiles.forEach((file) => {
      file.isSelected = true;
    });

    this._onDidChangeTreeData.fire();
  }

  deselectAllFiles(): void {
    this.changelists.forEach((changelist) => {
      changelist.files.forEach((file) => {
        file.isSelected = false;
      });
    });

    this.unversionedFiles.forEach((file) => {
      file.isSelected = false;
    });

    this._onDidChangeTreeData.fire();
  }

  getChangelists(): Changelist[] {
    return this.changelists;
  }

  getChangelistTreeItems(): ChangelistTreeItem[] {
    return this.changelists.map((changelist) => {
      let collapsibleState: vscode.TreeItemCollapsibleState;

      if (changelist.files.length === 0) {
        collapsibleState = vscode.TreeItemCollapsibleState.None;
      } else if (changelist.isExpanded === true) {
        collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      } else if (changelist.isExpanded === false) {
        collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      } else {
        // Default behavior - expand if has files
        collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      }

      const treeItem = new ChangelistTreeItem(changelist, collapsibleState);
      return treeItem;
    });
  }

  getChangelistTreeItemById(changelistId: string): ChangelistTreeItem | undefined {
    const changelist = this.changelists.find((c) => c.id === changelistId);
    if (!changelist) {
      return undefined;
    }

    let collapsibleState: vscode.TreeItemCollapsibleState;
    if (changelist.files.length === 0) {
      collapsibleState = vscode.TreeItemCollapsibleState.None;
    } else if (changelist.isExpanded === true) {
      collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else if (changelist.isExpanded === false) {
      collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    } else {
      // Default behavior - expand if has files
      collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    }

    return new ChangelistTreeItem(changelist, collapsibleState);
  }

  getUnversionedFiles(): FileItem[] {
    return this.unversionedFiles;
  }

  getAllFiles(): FileItem[] {
    const allFiles: FileItem[] = [];

    for (const changelist of this.changelists) {
      allFiles.push(...changelist.files);
    }

    allFiles.push(...this.unversionedFiles);

    return allFiles;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Drag and drop implementation
  async handleDrag(
    source: readonly vscode.TreeItem[],
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    const fileIds: string[] = [];
    const changelistIds: string[] = [];

    for (const item of source) {
      if (item instanceof FileTreeItem) {
        fileIds.push(item.file.id);
      } else if (item instanceof ChangelistTreeItem) {
        changelistIds.push(item.changelist.id);
      }
    }

    if (fileIds.length > 0) {
      dataTransfer.set('application/vnd.code.tree.jetbrains-commit-manager', new vscode.DataTransferItem(fileIds));
    }

    if (changelistIds.length > 0) {
      dataTransfer.set(
        'application/vnd.code.tree.jetbrains-commit-manager.changelist',
        new vscode.DataTransferItem(changelistIds)
      );
    }
  }

  async handleDrop(
    target: vscode.TreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    if (!target) {
      return;
    }

    let targetChangelistId: string;

    if (target instanceof ChangelistTreeItem) {
      // Dropping on a changelist - move files to that changelist
      targetChangelistId = target.changelist.id;
    } else if (target instanceof FileTreeItem) {
      // Dropping on a file - move files to the changelist containing the target file
      targetChangelistId = target.changelistId || 'default';
    } else {
      // Unknown target type
      return;
    }

    // Handle file drops
    const fileTransferItem = dataTransfer.get('application/vnd.code.tree.jetbrains-commit-manager');
    if (fileTransferItem) {
      try {
        const fileIds = fileTransferItem.value as string[];
        if (Array.isArray(fileIds)) {
          // Move each file to the target changelist
          for (const fileId of fileIds) {
            await this.moveFileToChangelist(fileId, targetChangelistId);
          }
        }
      } catch (error) {
        console.error('Error handling file drop:', error);
      }
    }

    // Handle changelist drops
    const changelistTransferItem = dataTransfer.get('application/vnd.code.tree.jetbrains-commit-manager.changelist');
    if (changelistTransferItem) {
      try {
        const changelistIds = changelistTransferItem.value as string[];
        if (Array.isArray(changelistIds)) {
          // Move all files from source changelists to target changelist
          for (const sourceChangelistId of changelistIds) {
            if (sourceChangelistId !== targetChangelistId) {
              // Don't move to self
              await this.moveChangelistFiles(sourceChangelistId, targetChangelistId);
            }
          }
        }
      } catch (error) {
        console.error('Error handling changelist drop:', error);
      }
    }

    // Auto-expand the target changelist to show the dropped files
    const targetChangelist = this.changelists.find((c) => c.id === targetChangelistId);
    if (targetChangelist && targetChangelist.files.length > 0) {
      targetChangelist.isExpanded = true;

      // Emit event to force visual expansion
      this._onChangelistAutoExpand.fire(targetChangelist.id);
    }
  }
}
