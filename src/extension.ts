// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { NativeTreeProvider, ChangelistTreeItem } from './nativeTreeProvider';
import { GitService } from './gitService';
import { FileItem } from './types';
import { CommitUI } from './commitUI';

let treeProvider: NativeTreeProvider;
let treeView: vscode.TreeView<vscode.TreeItem>;
let gitService: GitService;
let commitStatusBarItem: vscode.StatusBarItem;
let commitMessageInput: vscode.StatusBarItem;
let isExpanded: boolean = false; // Track expand/collapse state
let commitUI: CommitUI;

export function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('No workspace folder found. Please open a folder to use the commit manager.');
  }

  if (workspaceRoot) {
    treeProvider = new NativeTreeProvider(workspaceRoot);
    gitService = new GitService(workspaceRoot);

    // Create the tree view
    treeView = vscode.window.createTreeView('jetbrains-commit-manager.changelists', {
      treeDataProvider: treeProvider,
      showCollapseAll: true,
      canSelectMany: true,
      dragAndDropController: treeProvider,
    });

    // Handle collapse all to toggle to expand all
    treeView.onDidCollapseElement((e) => {
      // When user manually collapses items, update our state and the changelist state
      if (e.element instanceof ChangelistTreeItem) {
        const changelistItem = e.element as ChangelistTreeItem;
        const changelist = treeProvider.getChangelists().find((c) => c.id === changelistItem.changelist.id);
        if (changelist) {
          changelist.isExpanded = false;
        }
      } else if (e.element.contextValue === 'unversionedSection') {
      }
      // Check if all changelists are collapsed
      const allCollapsed = treeProvider.getChangelists().every((c) => c.files.length === 0 || !c.isExpanded);
      isExpanded = !allCollapsed;
    });

    treeView.onDidExpandElement((e) => {
      // When user manually expands items, update our state and the changelist state
      if (e.element instanceof ChangelistTreeItem) {
        const changelistItem = e.element as ChangelistTreeItem;
        const changelist = treeProvider.getChangelists().find((c) => c.id === changelistItem.changelist.id);
        if (changelist) {
          changelist.isExpanded = true;
        }
      } else if (e.element.contextValue === 'unversionedSection') {
      }
      // Check if any changelist is expanded
      const anyExpanded = treeProvider.getChangelists().some((c) => c.files.length > 0 && c.isExpanded);
      isExpanded = anyExpanded;
    });

    // Handle checkbox state changes
    treeView.onDidChangeCheckboxState((e) => {
      treeProvider.onDidChangeCheckboxState(e);
      updateAllCommitUI();
    });

    // Removed force expand wiring

    // Listen for new changelist creation events
    treeProvider.onChangelistCreated(async (changelistId: string) => {
      try {
        setTimeout(async () => {
          const changelistItem = treeProvider.getChangelistTreeItemById(changelistId);
          if (changelistItem && changelistItem.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            await treeView.reveal(changelistItem, { expand: true, select: false, focus: false });
          }
        }, 200);
      } catch (error) {
        // Silently handle errors
      }
    });

    // Listen for changelist auto-expand events (when files are moved/dropped)
    treeProvider.onChangelistAutoExpand(async (changelistId: string) => {
      try {
        setTimeout(async () => {
          const changelistItem = treeProvider.getChangelistTreeItemById(changelistId);
          if (changelistItem && changelistItem.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            await treeView.reveal(changelistItem, { expand: true, select: false, focus: false });
          }
        }, 200);
      } catch (error) {
        // Silently handle errors
      }
    });

    // Create status bar items for commit functionality
    createCommitStatusBarItems();

    // Commit webview removed; commit via title button/status bar/command palette
  }

  // Register commands
  const commands = [
    vscode.commands.registerCommand('jetbrains-commit-manager.open', () => {
      if (treeView) {
        // Focus on the tree view
        vscode.commands.executeCommand('jetbrains-commit-manager.changelists.focus');
      }
    }),

    vscode.commands.registerCommand('jetbrains-commit-manager.createChangelist', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter changelist name',
        placeHolder: 'e.g., Feature X',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Changelist name cannot be empty';
          }
          if (treeProvider.getChangelists().some((c) => c.name === value.trim())) {
            return 'Changelist with this name already exists';
          }
          return null;
        },
      });

      if (name) {
        treeProvider.createChangelist(name.trim());
        treeProvider.refresh();
        updateAllCommitUI();
      }
    }),

    vscode.commands.registerCommand('jetbrains-commit-manager.deleteChangelist', async (changelistItem?: any) => {
      let changelistId: string;
      let changelistName: string;

      if (changelistItem && changelistItem.changelist) {
        // Called from inline context menu - changelistItem is a ChangelistTreeItem
        changelistId = changelistItem.changelist.id;
        changelistName = changelistItem.changelist.name;
      } else {
        // Called from command palette or other places - show selection dialog
        const changelists = treeProvider.getChangelists().filter((c) => !c.isDefault);
        if (changelists.length === 0) {
          vscode.window.showInformationMessage('No custom changelists to delete.');
          return;
        }

        const options = changelists.map((c) => ({ label: c.name, value: c.id }));
        const selected = await vscode.window.showQuickPick(options, {
          placeHolder: 'Select changelist to delete',
        });

        if (!selected) {
          return;
        }

        changelistId = selected.value;
        changelistName = selected.label;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete changelist "${changelistName}"?`,
        { modal: true },
        'Delete'
      );

      if (confirm === 'Delete') {
        treeProvider.deleteChangelist(changelistId);
        treeProvider.refresh();
        updateAllCommitUI();
      }
    }),

    vscode.commands.registerCommand('jetbrains-commit-manager.renameChangelist', async (changelistItem?: any) => {
      let changelistId: string;
      let currentName: string;

      if (changelistItem && changelistItem.changelist) {
        // Called from inline context menu - changelistItem is a ChangelistTreeItem
        changelistId = changelistItem.changelist.id;
        currentName = changelistItem.changelist.name;
      } else {
        // Called from command palette or other places - show selection dialog
        const changelists = treeProvider.getChangelists();
        if (changelists.length === 0) {
          vscode.window.showInformationMessage('No changelists to rename.');
          return;
        }

        const options = changelists.map((c) => ({ label: c.name, value: c.id }));
        const selected = await vscode.window.showQuickPick(options, {
          placeHolder: 'Select changelist to rename',
        });

        if (!selected) {
          return;
        }

        changelistId = selected.value;
        currentName = selected.label;
      }

      const newName = await vscode.window.showInputBox({
        prompt: 'Enter new changelist name',
        placeHolder: 'Enter new name...',
        value: currentName,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Changelist name cannot be empty';
          }
          if (treeProvider.getChangelists().some((c) => c.name === value.trim() && c.id !== changelistId)) {
            return 'Changelist with this name already exists';
          }
          return null;
        },
      });

      if (newName && newName.trim() !== currentName) {
        try {
          await treeProvider.renameChangelist(changelistId, newName.trim());
          vscode.window.showInformationMessage(`Changelist renamed to "${newName.trim()}"`);
          treeProvider.refresh();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to rename changelist: ${error}`);
        }
      }
    }),

    vscode.commands.registerCommand('jetbrains-commit-manager.commitSelectedFiles', async () => {
      const selectedFiles = treeProvider.getSelectedFiles();

      if (selectedFiles.length === 0) {
        vscode.window.showWarningMessage('No files selected for commit. Please select files first.');
        return;
      }

      const message = await vscode.window.showInputBox({
        prompt: 'Enter commit message',
        placeHolder: 'Describe your changes...',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Commit message cannot be empty';
          }
          return null;
        },
      });

      if (message) {
        const success = await gitService.commitFiles(selectedFiles, message.trim());

        if (success) {
          vscode.window.showInformationMessage(`Successfully committed ${selectedFiles.length} file(s)`);
          treeProvider.refresh();
          updateAllCommitUI();
        } else {
          vscode.window.showErrorMessage('Failed to commit files. Check the output panel for details.');
        }
      }
    }),

    vscode.commands.registerCommand('jetbrains-commit-manager.moveFileToChangelist', async (fileId?: string) => {
      let filesToMove: FileItem[] = [];

      if (fileId) {
        // If a specific file ID is provided (from context menu), move that file
        const allFiles = treeProvider.getAllFiles();
        const file = allFiles.find((f) => f.id === fileId);
        if (file) {
          filesToMove = [file];
        }
      } else {
        // Otherwise, move selected files
        filesToMove = treeProvider.getSelectedFiles();
      }

      if (filesToMove.length === 0) {
        vscode.window.showWarningMessage('No files selected. Please select files first.');
        return;
      }

      const changelists = treeProvider.getChangelists();
      const options = changelists.map((c) => ({ label: c.name, value: c.id }));

      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Select target changelist',
      });

      if (selected) {
        for (const file of filesToMove) {
          await treeProvider.moveFileToChangelist(file.id, selected.value);
        }
        treeProvider.refresh();
        updateAllCommitUI();
      }
    }),

    vscode.commands.registerCommand('jetbrains-commit-manager.toggleFileSelection', (fileId: string) => {
      treeProvider.toggleFileSelection(fileId);
      treeProvider.refresh();
      updateAllCommitUI();
    }),

    vscode.commands.registerCommand('jetbrains-commit-manager.refresh', () => {
      treeProvider.refresh();
      updateAllCommitUI();
    }),

    // Removed expandAll command

    vscode.commands.registerCommand('jetbrains-commit-manager.collapseAll', () => {
      if (treeProvider) {
        treeProvider.collapseAll();
        isExpanded = false;
      }
    }),

    vscode.commands.registerCommand('jetbrains-commit-manager.revertSelectedFiles', async () => {
      const selectedFiles = treeProvider.getSelectedFiles();

      if (selectedFiles.length === 0) {
        vscode.window.showWarningMessage('No files selected for revert. Please select files first.');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to revert ${selectedFiles.length} file(s)? This will discard all uncommitted changes.`,
        { modal: true },
        'Revert'
      );

      if (confirm === 'Revert') {
        const success = await gitService.revertFiles(selectedFiles);

        if (success) {
          vscode.window.showInformationMessage(`Successfully reverted ${selectedFiles.length} file(s)`);
          treeProvider.refresh();
          updateAllCommitUI();
        } else {
          vscode.window.showErrorMessage('Failed to revert files. Check the output panel for details.');
        }
      }
    }),

    // Revert a single file from context menu
    vscode.commands.registerCommand('jetbrains-commit-manager.revertFile', async (arg?: any) => {
      let fileToRevert: FileItem | undefined;
      const allFiles = treeProvider.getAllFiles();

      if (typeof arg === 'string') {
        fileToRevert = allFiles.find((f) => f.id === arg);
      } else if (arg && arg.file) {
        // Invoked from context menu: arg is FileTreeItem
        fileToRevert = arg.file as FileItem;
      } else if (arg && arg.resourceUri) {
        const fsPath: string = arg.resourceUri.fsPath as string;
        // match by path tail relative path presence
        fileToRevert = allFiles.find((f) => fsPath.endsWith(f.path));
      }
      if (!fileToRevert) {
        vscode.window.showWarningMessage('No file selected to revert.');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Revert changes in ${fileToRevert.name}? This discards uncommitted changes.`,
        { modal: true },
        'Revert'
      );
      if (confirm !== 'Revert') {
        return;
      }

      const success = await gitService.revertFiles([fileToRevert]);
      if (success) {
        vscode.window.showInformationMessage(`Reverted ${fileToRevert.name}`);
        treeProvider.refresh();
        updateAllCommitUI();
      }
    }),

    // Revert all files in a changelist from context menu
    vscode.commands.registerCommand('jetbrains-commit-manager.revertChangelist', async (changelistItem?: any) => {
      if (!changelistItem || !changelistItem.changelist) {
        return;
      }
      const changelistId: string = changelistItem.changelist.id;
      const changelistName: string = changelistItem.changelist.name;
      const files = treeProvider.getChangelists().find((c) => c.id === changelistId)?.files || [];
      if (files.length === 0) {
        vscode.window.showInformationMessage('No files to revert in this changelist.');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Revert all ${files.length} file(s) in "${changelistName}"? This discards uncommitted changes.`,
        { modal: true },
        'Revert'
      );
      if (confirm !== 'Revert') {
        return;
      }

      const success = await gitService.revertFiles(files);
      if (success) {
        vscode.window.showInformationMessage(`Reverted ${files.length} file(s) in "${changelistName}"`);
        treeProvider.refresh();
        updateAllCommitUI();
      }
    }),

    vscode.commands.registerCommand('jetbrains-commit-manager.selectAllFiles', () => {
      treeProvider.selectAllFiles();
      treeProvider.refresh();
      updateAllCommitUI();
    }),

    vscode.commands.registerCommand('jetbrains-commit-manager.deselectAllFiles', () => {
      treeProvider.deselectAllFiles();
      treeProvider.refresh();
      updateAllCommitUI();
    }),

    // New command for status bar commit button
    vscode.commands.registerCommand('jetbrains-commit-manager.commitFromStatusBar', async () => {
      const selectedFiles = treeProvider.getSelectedFiles();

      if (selectedFiles.length === 0) {
        vscode.window.showWarningMessage('No files selected for commit. Please select files first.');
        return;
      }

      // Get commit message from the input field
      const message = await vscode.window.showInputBox({
        prompt: 'Enter commit message',
        placeHolder: 'Describe your changes...',
        value: commitMessageInput.text.replace('📝 ', ''), // Remove the icon prefix
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Commit message cannot be empty';
          }
          return null;
        },
      });

      if (message) {
        const success = await gitService.commitFiles(selectedFiles, message.trim());

        if (success) {
          vscode.window.showInformationMessage(`Successfully committed ${selectedFiles.length} file(s)`);
          treeProvider.refresh();
          updateAllCommitUI();
          // Clear the commit message input
          commitMessageInput.text = '📝 ';
        } else {
          vscode.window.showErrorMessage('Failed to commit files. Check the output panel for details.');
        }
      }
    }),

    // Command to update commit message in status bar
    vscode.commands.registerCommand('jetbrains-commit-manager.updateCommitMessage', async () => {
      const message = await vscode.window.showInputBox({
        prompt: 'Enter commit message',
        placeHolder: 'Describe your changes...',
        value: commitMessageInput.text.replace('📝 ', ''),
      });

      if (message !== undefined) {
        commitMessageInput.text = `📝 ${message}`;
      }
    }),

    // Command to toggle auto-stage feature
    vscode.commands.registerCommand('jetbrains-commit-manager.toggleAutoStage', async () => {
      const config = vscode.workspace.getConfiguration('jetbrains-commit-manager');
      const currentValue = config.get<boolean>('autoStageFiles', true);
      const newValue = !currentValue;

      await config.update('autoStageFiles', newValue, vscode.ConfigurationTarget.Workspace);

      const status = newValue ? 'enabled' : 'disabled';
      vscode.window.showInformationMessage(`Auto-stage files ${status}`);
    }),

    // Test command to verify extension is working
    vscode.commands.registerCommand('jetbrains-commit-manager.test', () => {
      vscode.window.showInformationMessage('JetBrains Commit Manager extension is working!');
    }),
  ];

  context.subscriptions.push(...commands);

  if (treeView) {
    context.subscriptions.push(treeView);
  }

  if (treeProvider) {
    treeProvider.refresh();
    updateAllCommitUI();
  }

  // Set up file system watcher to refresh on file changes
  const fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*');
  fileSystemWatcher.onDidChange(async (uri) => {
    if (treeProvider) {
      // Auto-stage the changed file if the feature is enabled
      const config = vscode.workspace.getConfiguration('jetbrains-commit-manager');
      const autoStageEnabled = config.get<boolean>('autoStageFiles', true);

      if (autoStageEnabled && gitService) {
        const relativePath = vscode.workspace.asRelativePath(uri);

        // Skip auto-staging for certain file types
        if (shouldSkipAutoStage(relativePath)) {
          return;
        }

        // Only auto-stage files that are already tracked by Git
        const isTracked = await gitService.isFileTracked(relativePath);
        if (!isTracked) {
          return;
        }

        try {
          await gitService.stageFile(relativePath);
        } catch (error) {
          console.error(`Failed to auto-stage file ${relativePath}:`, error);
        }
      }

      treeProvider.refresh();
      updateAllCommitUI();
    }
  });
  fileSystemWatcher.onDidCreate(async (uri) => {
    if (treeProvider) {
      // Auto-stage the new file if the feature is enabled
      const config = vscode.workspace.getConfiguration('jetbrains-commit-manager');
      const autoStageEnabled = config.get<boolean>('autoStageFiles', true);

      if (autoStageEnabled && gitService) {
        const relativePath = vscode.workspace.asRelativePath(uri);

        // Skip auto-staging for certain file types
        if (shouldSkipAutoStage(relativePath)) {
          return;
        }

        // Only auto-stage files that are already tracked by Git
        const isTracked = await gitService.isFileTracked(relativePath);
        if (!isTracked) {
          return;
        }

        try {
          await gitService.stageFile(relativePath);
        } catch (error) {
          console.error(`Failed to auto-stage file ${relativePath}:`, error);
        }
      }

      treeProvider.refresh();
      updateAllCommitUI();
    }
  });
  fileSystemWatcher.onDidDelete(() => {
    if (treeProvider) {
      treeProvider.refresh();
      updateAllCommitUI();
    }
  });

  context.subscriptions.push(fileSystemWatcher);
}

function createCommitStatusBarItems() {
  // Create commit button in status bar
  commitStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  commitStatusBarItem.command = 'jetbrains-commit-manager.commitFromStatusBar';
  commitStatusBarItem.tooltip = 'Commit selected files';
  commitStatusBarItem.show();

  // Create commit message input in status bar
  commitMessageInput = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
  commitMessageInput.command = 'jetbrains-commit-manager.updateCommitMessage';
  commitMessageInput.tooltip = 'Click to edit commit message';
  commitMessageInput.text = '📝 ';
  commitMessageInput.show();

  updateAllCommitUI();
}

function updateCommitStatusBar() {
  if (!treeProvider) {
    return;
  }

  const selectedFiles = treeProvider.getSelectedFiles();
  const totalFiles = treeProvider.getAllFiles().length;

  if (selectedFiles.length > 0) {
    commitStatusBarItem.text = `$(check) Commit (${selectedFiles.length}/${totalFiles})`;
    commitStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
  } else {
    commitStatusBarItem.text = '$(check) Commit';
    commitStatusBarItem.backgroundColor = undefined;
  }
}

function updateAllCommitUI() {
  // Only update status bar now that the commit webview is removed
  updateCommitStatusBar();
}

export function deactivate() {
  if (commitStatusBarItem) {
    commitStatusBarItem.dispose();
  }
  if (commitMessageInput) {
    commitMessageInput.dispose();
  }
}

// Helper function to determine if a file should be skipped for auto-staging
function shouldSkipAutoStage(filePath: string): boolean {
  const skipPatterns = [
    // Temporary files
    /\.tmp$/,
    /\.temp$/,
    /\.swp$/,
    /\.swo$/,
    /~$/,

    // Build artifacts
    /\.log$/,
    /\.out$/,
    /\.exe$/,
    /\.dll$/,
    /\.so$/,
    /\.dylib$/,
    /\.o$/,
    /\.obj$/,
    /\.class$/,

    // IDE and editor files
    /\.vscode\//,
    /\.idea\//,
    /\.vs\//,
    /\.DS_Store$/,
    /Thumbs\.db$/,

    // Node.js
    /node_modules\//,
    /npm-debug\.log$/,
    /yarn-error\.log$/,

    // Git
    /\.git\//,

    // Package managers
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/,

    // Environment files
    /\.env$/,
    /\.env\.local$/,
    /\.env\.development$/,
    /\.env\.production$/,
  ];

  return skipPatterns.some((pattern) => pattern.test(filePath));
}
