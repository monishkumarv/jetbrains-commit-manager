# JetBrains Commit Manager

A VS Code extension that brings JetBrains-like commit workflows (IntelliJ IDEA, GoLand, etc.) to VS Code: organize changes into changelists, drag & drop files between them, select exactly what to commit, and work efficiently from the status bar or command palette.

Try the extension from Visual Studio Code Marketplace here - [link](https://marketplace.visualstudio.com/items?itemName=monishkumarv.jetbrains-commit-manager)

## Features

### 🎯 JetBrains-Style Commit Management

- **Changelists**: Organize your changes into logical groups
- **Drag & Drop**: Move files between changelists in the tree view
- **Selective Commit**: Choose exactly which files to commit
- **Status Badges**: Clear indicators for modified/added/deleted/untracked/renamed files

### 📁 Changelist Management

- **Default Changelist**: All changes start in a default list
- **Custom Changelists**: Create, rename, and delete changelists
- **File Organization**: Drag files between lists or use context menus
- **Safe Deletion**: Deleting a changelist moves its files to the default

### ✅ File Selection & Committing

- **Checkbox Selection**: Click files to include/exclude from the next commit
- **Bulk Selection**: Quickly select or deselect all files
- **Smart Commit Button**: Commit button is only enabled when files are selected, with helpful tooltips
- **Status Bar Commit**: Enter commit message and commit from the status bar
- **Command Palette**: Commit via commands if you prefer keyboard-only flow

### 🔄 Real-time Updates

- **File Watching**: The view refreshes as files change, get created, or deleted
- **Git Integration**: Real-time status via `git status` and `git ls-files`
- **Manual Refresh**: Refresh command available any time
- **Auto-Stage Tracked Files**: On change/create, tracked files can be auto-staged (configurable)

## Getting Started

1. **Open the Commit Manager**

   - Command Palette: `Ctrl+Shift+P` / `Cmd+Shift+P` → "JetBrains Commit Manager: Open Commit Manager"
   - Or focus the view from the Activity Bar when pinned

2. **View Your Changes**

   - The sidebar shows a tree of your changelists and files
   - All modified files appear in the default changelist
   - Unversioned files appear in the "Unversioned Files" section

3. Create a New Changelist

   - Run "JetBrains Commit Manager: Create Changelist"
   - Enter a name (and optional description)

4. Move Files Between Changelists

   - **Drag & Drop**: Drag files from one changelist to another
   - **Context Menu**: Right-click a file → "Move File to Changelist"

5. Delete a Changelist

   - Right-click a changelist → "Delete Changelist"
   - Files are moved to the default changelist

6. Select Files for Commit

   - Click a file to toggle its selection (checkbox)
   - Use "Select All Files" or "Deselect All Files" for bulk operations

7. Commit Selected Files

   - Select files in the tree using checkboxes
   - The commit button will be enabled and show "Commit Selected Files"
   - Click the commit button from the status bar

## Commands

| Command                                             | Description                                 |
| --------------------------------------------------- | ------------------------------------------- |
| `JetBrains Commit Manager: Open Commit Manager`     | Focuses the commit manager view             |
| `JetBrains Commit Manager: Create Changelist`       | Creates a new changelist                    |
| `JetBrains Commit Manager: Rename Changelist`       | Renames an existing changelist              |
| `JetBrains Commit Manager: Delete Changelist`       | Deletes a changelist (files go to default)  |
| `JetBrains Commit Manager: Move File to Changelist` | Moves a file to a different changelist      |
| `JetBrains Commit Manager: Select All Files`        | Selects all files                           |
| `JetBrains Commit Manager: Deselect All Files`      | Deselects all files                         |
| `JetBrains Commit Manager: Refresh`                 | Refreshes the view                          |
| `JetBrains Commit Manager: Revert Selected Files`   | Reverts currently selected files            |
| `JetBrains Commit Manager: Revert File`             | Reverts a single file (context menu)        |
| `JetBrains Commit Manager: Revert Changelist`       | Reverts all files in a changelist           |
| `JetBrains Commit Manager: Commit Selected Files`   | Commits the selected files                  |
| `JetBrains Commit Manager: Commit from Status Bar`  | Commits using the status bar button         |
| `JetBrains Commit Manager: Update Commit Message`   | Updates the status bar commit message       |
| `JetBrains Commit Manager: Toggle Auto-Stage Files` | Toggles automatic staging for tracked files |

## Configuration

### Auto-Stage Files

The extension can automatically stage files when they are changed or created (only if already tracked by Git). Enabled by default; control via:

- **Settings**: Go to VS Code Settings and search for "jetbrains-commit-manager.autoStageFiles"
- **Command**: Use "JetBrains Commit Manager: Toggle Auto-Stage Files" command
- When enabled, tracked-file modifications are auto-staged; untracked files are never auto-staged to avoid adding temporary/build artifacts by accident.

#### Auto-Stage Skip Patterns

Certain files are intentionally skipped from auto-stage (examples): temp files (`*.tmp`, swap files), build artifacts (`*.log`, `*.o`, `*.class`), IDE files (`.vscode/`, `.idea/`), `node_modules/`, lockfiles, `.git/`, and environment files like `.env*`.

## Installation

1. Clone or download this extension
2. Run `npm install` to install dependencies
3. Run `npm run compile` to compile TypeScript
4. Press F5 in VS Code to launch the extension in debug mode
5. Or package the extension and install it in VS Code

## Development

### Building the Extension

```bash
npm install
npm run compile
```

### Running in Development Mode

```bash
npm run watch
```

Then press F5 in VS Code to launch the extension in debug mode.

### Testing

```bash
npm test
```

## Requirements

- VS Code 1.60.0 or higher
- Git repository in the workspace
- Git installed and accessible from the command line

## License

This extension is licensed under the MIT License.

## Acknowledgments

Inspired by the commit management features in JetBrains IDEs.
