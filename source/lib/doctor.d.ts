import type { SqliteDatabase } from './db/sqlite-adapter';
import { inspectModelAssets } from './docs/model-assets';
import type { IndexHealth } from './inventory/health';
export type { IndexHealth } from './inventory/health';
export interface DoctorReport {
    schemaVersion: 1;
    packageVersion: string;
    ok: boolean;
    runtime: {
        transformers: boolean;
        sqliteVec: boolean;
    };
    model: ReturnType<typeof inspectModelAssets> & {
        offlineReady: boolean;
    };
    database: {
        readable: boolean;
        schema: number;
        expectedSchema: number;
        nullProvenanceEdges: number;
        semanticEdges: number;
    };
    communities: {
        state: 'absent' | 'ready' | 'invalid';
        path: string;
        issue?: string;
    };
    indexHealth: IndexHealth;
    warnings: string[];
}
export declare function buildDoctorReport(db: SqliteDatabase, projectRoot: string, packageVersion: string): Promise<DoctorReport>;
export declare function readIndexHealth(db: SqliteDatabase): IndexHealth;
//# sourceMappingURL=doctor.d.ts.map
