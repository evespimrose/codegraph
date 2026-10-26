import type { SqliteDatabase } from '../db/sqlite-adapter';
export interface IndexHealth {
    healthy: boolean;
    inventoryErrors: number;
    sourceErrors: number;
    documentErrors: number;
    queryErrors: number;
    warnings: string[];
}
export declare function readIndexHealth(db: SqliteDatabase): IndexHealth;
