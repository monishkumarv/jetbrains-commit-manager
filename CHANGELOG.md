# Changelog

All notable changes to the "JetBrains Commit Manager" extension will be documented in this file.

## [0.0.2] - 2024-12-19

### Added

- **Auto-Stage Files**: Automatically stage files when they are changed or created
- **Configuration Option**: Toggle auto-stage feature through settings
- **Toggle Command**: "JetBrains Commit Manager: Toggle Auto-Stage Files" command
- **View Title Button**: Quick toggle button in the commit manager view title

### Features

- **Automatic Staging**: Files are automatically staged when modified or created (enabled by default)
- **Configurable Behavior**: Users can enable/disable auto-staging through settings
- **Visual Feedback**: Console logging for successful and failed auto-stage operations
- **Non-Intrusive**: Auto-staging happens in the background without interrupting workflow

## [0.0.1] - 2024-08-22

### Added

- Initial release of JetBrains Commit Manager
- Webview-based commit management interface
- Changelist organization with default and custom changelists
- File status indicators (modified, added, deleted, untracked, renamed)
- Checkbox-based file selection for commits
- Bulk file selection (select all, deselect all)
- File movement between changelists
- Commit dialog with message input
- Real-time Git status integration
- Visual file status indicators with color coding
- Support for unversioned files management

### Features

- **Changelist Management**: Create, delete, and organize changelists
- **File Organization**: Move files between changelists
- **Selective Committing**: Choose which files to commit with checkboxes
- **Git Integration**: Real-time Git status and commit operations
- **Modern UI**: Clean, JetBrains-inspired webview interface
- **Keyboard Shortcuts**: Enter key support for quick commits

### Technical Details

- Built with TypeScript and VS Code Extension API
- Uses webview for rich interactive interface
- Git operations via command line interface
- File system watching for automatic updates
- Modular architecture with separate services for Git operations

### Requirements

- VS Code 1.103.0 or higher
- Git repository in workspace
- Git installed and accessible from command line
