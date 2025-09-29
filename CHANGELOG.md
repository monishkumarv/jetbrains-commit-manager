# Changelog

All notable changes to the "JetBrains Commit Manager" extension will be documented in this file.

## [0.0.5] - 2025-12-29

### Added

- **Amend Commit support**: Toggle amend in commit dialog, webview, and compact sidebar UI
- **Push options**: Commit and Push, Amend Commit and Push
- **Status Bar actions**: Commit and Stash directly from the status bar
- **Commands**: `Open Diff`, `Open File`, `Update Commit Message`
- **Changelist actions**: Rename, Revert, and Delete from context menus

### Changed

- **UX improvements**: Clearer button labels, inline amend indicator, improved confirmations
- **Git integration**: Automatically sets upstream on first push when missing

### Fixed

- More robust error handling for commit/push/stash operations
- Reliability improvements in changelist updates and file selection state

## [0.0.4] - 2025-09-29

### Added

- **Smart Stashing**: Stash  selected files
- **Context Menu Enhancements**: Quick access to file open and diff actions

## [0.0.3] - 2025-09-25

### Fixed

- Resolved versioning issues and updated logo

### Changed

- **UI polish**: Improved layout and responsiveness in the commit manager view

## [0.0.2] - 2025-09-25

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

## [0.0.1] - 2025-09-25

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
