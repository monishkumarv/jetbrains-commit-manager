# JetBrains Commit Manager

A VS Code extension that replicates the commit management functionality of JetBrains IDEs (like GoLand, IntelliJ IDEA, etc.) with drag-and-drop changelist management and selective file committing.

## Features

### 🎯 JetBrains-Style Commit Management

- **Changelist Organization**: Organize your changes into logical groups (changelists)
- **Drag & Drop**: Move files between changelists by dragging and dropping
- **Selective Committing**: Choose which files to commit with checkboxes
- **Visual Status Indicators**: See file status (modified, added, deleted, untracked) with color-coded icons

### 📁 Changelist Management

- **Default Changelist**: All changes start in the default changelist
- **Custom Changelists**: Create named changelists for different features or tasks
- **File Organization**: Drag files between changelists without using CLI
- **Changelist Deletion**: Delete changelists (files move to default)

### ✅ File Selection & Committing

- **Checkbox Selection**: Click files to select/deselect them for commit
- **Bulk Operations**: Select all or deselect all files
- **Integrated Commit UI**: Commit message input and button in a dedicated commit section
- **Source Control Style UI**: Commit UI similar to VS Code's Source Control tab
- **File Preview**: See which files will be committed before confirming

### 🔄 Real-time Updates

- **File System Watching**: Automatically refresh when files change
- **Git Status Integration**: Real-time Git status updates
- **Live Refresh**: Manual refresh option available
- **Auto-Stage Files**: Automatically stage modified files that are already tracked by Git (untracked files are not auto-staged)

## Usage

### Getting Started

1. **Open the Commit Manager**:

   - Use the command palette: `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "JetBrains Commit Manager: Open Commit Manager"
   - Or use the command: `JetBrains Commit Manager: Open Commit Manager`

2. **View Your Changes**:
   - The commit manager will appear in the sidebar with two sections:
     - **Commit**: A dedicated commit UI section with message input and commit button
     - **Changelists**: The tree view showing your changelists and files
   - All modified files appear in the "Default" changelist
   - Unversioned files appear in the "Unversioned Files" section

### Managing Changelists

#### Create a New Changelist

1. Click the "Create Changelist" button in the view title
2. Enter a name for your changelist
3. Optionally add a description

#### Move Files Between Changelists

- **Drag & Drop**: Drag files from one changelist to another
- **Context Menu**: Right-click a file and select "Move File to Changelist"

#### Delete a Changelist

- Right-click on a changelist and select "Delete Changelist"
- Files will be moved to the default changelist

### Committing Files

#### Select Files for Commit

- Click on files to toggle their selection (checkbox behavior)
- Use "Select All Files" or "Deselect All Files" for bulk operations

#### Commit Selected Files

**Method 1: Using Commit UI (Recommended)**

1. Select the files you want to commit
2. In the "Commit" section at the top of the sidebar, enter your commit message
3. Click the "Commit" button or press `Ctrl+Enter` to commit
4. The button shows the count of selected files (e.g., "Commit (3)")

**Method 2: Using Status Bar**

1. Select the files you want to commit
2. Click the commit message input field (📝) in the status bar to enter your message
3. Click the "Commit" button in the status bar

**Method 3: Using Command**

1. Select the files you want to commit
2. Use the command palette: "JetBrains Commit Manager: Commit Selected Files"
3. Enter your commit message in the dialog
4. Click "Commit" to confirm

### File Status Indicators

- 🔄 **Modified**: Files that have been changed
- ➕ **Added**: New files added to version control
- 🗑️ **Deleted**: Files that have been removed
- ❓ **Untracked**: New files not yet in version control
- 🔄 **Renamed**: Files that have been renamed

## Commands

| Command                                             | Description                            |
| --------------------------------------------------- | -------------------------------------- |
| `JetBrains Commit Manager: Open Commit Manager`     | Opens the commit manager view          |
| `JetBrains Commit Manager: Create Changelist`       | Creates a new changelist               |
| `JetBrains Commit Manager: Delete Changelist`       | Deletes the selected changelist        |
| `JetBrains Commit Manager: Commit Selected Files`   | Commits the selected files             |
| `JetBrains Commit Manager: Move File to Changelist` | Moves a file to a different changelist |
| `JetBrains Commit Manager: Refresh`                 | Refreshes the commit manager view      |
| `JetBrains Commit Manager: Select All Files`        | Selects all files                      |
| `JetBrains Commit Manager: Deselect All Files`      | Deselects all files                    |
| `JetBrains Commit Manager: Commit from Status Bar`  | Commits files using status bar button  |
| `JetBrains Commit Manager: Update Commit Message`   | Updates commit message in status bar   |
| `JetBrains Commit Manager: Toggle Auto-Stage Files` | Toggles automatic file staging         |

## Requirements

- VS Code 1.103.0 or higher
- Git repository in the workspace
- Git installed and accessible from the command line

## Configuration

### Auto-Stage Files

The extension can automatically stage files when they are changed or created. This feature is enabled by default but can be controlled through:

- **Settings**: Go to VS Code Settings and search for "jetbrains-commit-manager.autoStageFiles"
- **Command**: Use "JetBrains Commit Manager: Toggle Auto-Stage Files" command
- **Button**: Click the toggle button in the commit manager view title

When enabled, any modifications to files that are already tracked by Git will be automatically staged. New untracked files are not auto-staged to prevent accidentally adding temporary or build files to version control.

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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This extension is licensed under the MIT License.

## Acknowledgments

This extension is inspired by the excellent commit management features in JetBrains IDEs, particularly GoLand and IntelliJ IDEA.
