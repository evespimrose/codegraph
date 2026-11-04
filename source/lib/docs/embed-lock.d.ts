export interface EmbedLock {
    touch(): void;
    release(): void;
}
/** Waits for the machine-wide embedding lock; null if waiting exceeded maxWaitMs. */
export declare function acquireEmbedLock(options?: {
    dir: string;
    maxWaitMs?: number;
    onWait?: () => void;
}): Promise<EmbedLock | null>;
