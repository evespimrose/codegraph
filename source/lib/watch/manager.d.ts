export interface WatcherOptions {
    debounceMs?: number;
    respectGitignore?: boolean;
    timeoutMs?: number;
    restart?: boolean;
}
export interface WatcherStatus {
    projectPath: string;
    projectId: string;
    active: boolean;
    ready: boolean;
    phase: string;
    pid?: number | null;
    runtimeId?: string | null;
    nodePath?: string;
    runtimeEntry?: string;
    configuration?: { debounceMs?: number; respectGitignore: boolean };
    watching?: boolean;
    pendingFiles?: Array<{ path: string; firstSeenMs: number; lastSeenMs: number; indexing: boolean }>;
    lastSync?: { filesChanged: number; durationMs: number; at: number; warnings?: string[] } | null;
    lastError?: { message: string; at: number } | null;
    error?: string;
    stopPending?: boolean;
    restartPending?: boolean;
}
export declare function ensureWatcher(projectPath: string, options?: WatcherOptions): Promise<WatcherStatus>;
export declare function stopWatcher(projectPath: string, options?: { timeoutMs?: number }): Promise<WatcherStatus>;
export declare function watcherStatus(projectPath: string): Promise<WatcherStatus>;
export declare function listWatchers(): Promise<WatcherStatus[]>;
export declare function runWatcher(projectPath: string, options?: WatcherOptions & { runtimeId?: string }): Promise<void>;
