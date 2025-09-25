export interface Changelist {
  id: string;
  name: string;
  description?: string;
  files: FileItem[];
  isDefault?: boolean;
  isExpanded?: boolean;
  createdAt: Date;
}

export interface FileItem {
  id: string;
  path: string;
  name: string;
  status: FileStatus;
  isSelected: boolean;
  changelistId?: string;
  relativePath: string;
}

export enum FileStatus {
  MODIFIED = 'modified',
  ADDED = 'added',
  DELETED = 'deleted',
  UNTRACKED = 'untracked',
  RENAMED = 'renamed',
}

export interface CommitOptions {
  message: string;
  files: FileItem[];
  changelistId?: string;
}

export interface DragDropData {
  type: 'file' | 'changelist';
  id: string;
  sourceChangelistId?: string;
}

export interface CommitManagerState {
  changelists: Changelist[];
  unversionedFiles: FileItem[];
  selectedFiles: Set<string>;
  activeChangelistId?: string;
}
