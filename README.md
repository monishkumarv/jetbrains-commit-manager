# JetBrains Commit Manager

What are these? Will these work?

Bring JetBrains-style commit workflows to VS Code. Organize changes into changelists, drag & drop files between them, and commit exactly what you want.

## Features

- **🎯 Changelists**: Organize your changes into logical groups
- **🔄 Drag & Drop**: Move files between changelists seamlessly
- **✅ Selective Commit**: Choose exactly which files to commit
- **📦 Smart Stashing**: Stash only selected files, not all changes
- **⚡ Real-time Updates**: View refreshes as files change
- **🎨 Status Bar Integration**: Commit and stash directly from the status bar

## Quick Start

1. **Open the extension**:
   - Click the JetBrains Commit Manager icon in the sidebar, or
   - `Ctrl+Shift+P` → "JetBrains Commit Manager: Open Commit Manager"
2. **Create changelists**: Right-click → "Create Changelist"
3. **Organize files**: Drag files between changelists
4. **Select & commit**: Select files you want to commit, then use the status bar button to commit your files
5. **Select & stash**: You can also select files you want to stash, then use the status bar button to stash your files

## Installation

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "JetBrains Commit Manager"
4. Click **Install**

... or if the extension is not visible in the marketplace (sometimes happens in Vs Code wrappers such as Cursor IDE, etc.)

### Option A: Add Open VSX gallery (recommended for Cursor)

1. Open Settings (`Cmd+,` on macOS or `Ctrl+,` on Windows/Linux)
2. Search for "Extensions: Additional Extension Galleries"
3. Click "Edit in settings.json"
4. Add the Open VSX gallery URL to `extensions.gallery.serviceUrl`:

```json
{
  "extensions.gallery.serviceUrl": "https://open-vsx.org/vscode/gallery"
}
```

5. Reload the window
6. Open Extensions (`Ctrl/Cmd+Shift+X`), search "JetBrains Commit Manager", and install

### Option B: Install from VSIX (offline/manual)

1. Download the `.vsix` file from the [Open VSX](https://open-vsx.org/extension/monishkumarv/jetbrains-commit-manager) page
2. Open VS Code/Cursor IDE
3. Go to Extensions (`Ctrl+Shift+X`)
4. Click the "..." menu → "Install from VSIX..."
5. Select the downloaded `.vsix` file
6. **Don't forget to enable auto-updates** in extension settings

## Usage

### Changelists

- **Create**: Right-click in the sidebar → "Create Changelist"
- **Move files**: Drag & drop files between changelists
- **Delete**: Right-click changelist → "Delete Changelist" (files move to default)
- **Revert**: Right-click changelist → "Revert Changelist"

### Committing and Ammending commits

- **Select files**: Click checkboxes next to files
- **Commit**: Use the status bar button or `Ctrl+Shift+P` → "Commit Selected Files". When committing from commands or the status bar, you can choose:
  - `Commit`
  - `Amend Commit`
  - `Commit and Push`
  - `Amend Commit and Push`
- **Amend**: In the webview and commit dialog, there is an "Amend last commit" checkbox. In the compact sidebar UI, right‑click the Commit button to toggle "Amend" (button label shows "Amend:" when active).
- **Push**: Choosing a "…and Push" option will push the current branch after a successful commit. If the branch has no upstream set, the extension will set upstream to `origin/<branch>` on first push.
- **Stash**: Use the stash button next to commit for temporary storage

### Commands

| Command                 | Description                     |
| ----------------------- | ------------------------------- |
| `Open Commit Manager`   | Focus the commit manager view   |
| `Create Changelist`     | Create a new changelist         |
| `Commit Selected Files` | Commit currently selected files |
| `Stash Selected Files`  | Stash currently selected files  |
| `Open File`             | Open the source file            |
| `Open Diff`             | Show diff (HEAD ↔ working tree) |

## Configuration

- **Auto-stage files**: Automatically stage tracked files when modified (enabled by default)
- **Toggle**: `Ctrl+Shift+P` → "Toggle Auto-Stage Files"

## Requirements

- VS Code 1.60.0+
- Git repository in workspace
- Git installed and accessible

## License

MIT License - see [LICENSE](LICENSE) file for details.

<br /><br /><br />

<p align="center">
  <a href="https://github.com/monishkumarv/jetbrains-commit-manager">
    <img src="https://img.shields.io/badge/Built%20with-%E2%9D%A4%EF%B8%8F-blue" alt="Made with Love" />
  </a>
  <br />
  <sub>
    Inspired by JetBrains IDEs • 
    <a href="https://github.com/monishkumarv/jetbrains-commit-manager/issues">Report Issues</a> • 
    <a href="https://github.com/monishkumarv/jetbrains-commit-manager">View Source</a>
  </sub>
</p>
