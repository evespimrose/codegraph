"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentStore = void 0;
const crypto_1 = require("crypto");
const embed_1 = require("./embed");
const vec_1 = require("./vec");
class DocumentStore {
    db;
    selectMetadata;
    selectId;
    updateFileStats;
    upsertMetadata;
    deleteFts;
    insertFts;
    deleteMetadata;
    selectDocumentNodes;
    deleteEdges;
    deleteDocumentNodes;
    insertConcept;
    deleteVector;
    insertVector;
    markEmbedded;
    constructor(db, vectorAvailable) {
        this.db = db;
        this.selectMetadata = db.prepare('SELECT id, file_path, content_hash, embedding_model, file_size, modified_at FROM mdast_metadata WHERE file_path = ?');
        this.selectId = db.prepare('SELECT id FROM mdast_metadata WHERE file_path = ?');
        this.updateFileStats = db.prepare(`UPDATE mdast_metadata SET file_size = ?, modified_at = ?, last_updated = datetime('now') WHERE id = ?`);
        this.upsertMetadata = db.prepare(`
      INSERT INTO mdast_metadata (
        file_path, blk_tags, code_refs, doc_links, content_summary, content_hash,
        format, title, structure_json, embedding_model, file_size, modified_at, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, datetime('now'))
      ON CONFLICT(file_path) DO UPDATE SET
        blk_tags = excluded.blk_tags, code_refs = excluded.code_refs,
        doc_links = excluded.doc_links, content_summary = excluded.content_summary,
        content_hash = excluded.content_hash, format = excluded.format,
        title = excluded.title, structure_json = excluded.structure_json,
        embedding_model = NULL, file_size = excluded.file_size,
        modified_at = excluded.modified_at, last_updated = excluded.last_updated
    `);
        this.deleteFts = db.prepare('DELETE FROM document_fts WHERE rowid = ?');
        this.insertFts = db.prepare('INSERT INTO document_fts(rowid, file_path, title, summary, structure) VALUES (?, ?, ?, ?, ?)');
        this.deleteMetadata = db.prepare('DELETE FROM mdast_metadata WHERE id = ?');
        this.selectDocumentNodes = db.prepare(`SELECT id FROM nodes WHERE file_path = ? AND language = 'markdown'`);
        this.deleteEdges = db.prepare('DELETE FROM edges WHERE source = ? OR target = ?');
        this.deleteDocumentNodes = db.prepare(`DELETE FROM nodes WHERE file_path = ? AND language = 'markdown'`);
        this.insertConcept = db.prepare(`
      INSERT OR REPLACE INTO nodes
      (id, kind, name, qualified_name, file_path, language, start_line, end_line,
       start_column, end_column, domain_kind, metadata_json, updated_at)
      VALUES (?, 'concept', ?, ?, ?, 'markdown', ?, ?, 0, 0, 'markdown.blk', ?, ?)
    `);
        this.deleteVector = vectorAvailable ? db.prepare('DELETE FROM mdast_vectors WHERE rowid = ?') : null;
        this.insertVector = vectorAvailable ? db.prepare('INSERT INTO mdast_vectors(rowid, embedding) VALUES(?, ?)') : null;
        this.markEmbedded = vectorAvailable ? db.prepare('UPDATE mdast_metadata SET embedding_model = ? WHERE id = ?') : null;
    }
    getMetadata(filePath) {
        return this.selectMetadata.get(filePath);
    }
    listDocuments() {
        return this.db.prepare('SELECT id, file_path FROM mdast_metadata').all();
    }
    updateStats(id, fileSize, modifiedAt) {
        this.updateFileStats.run(fileSize, modifiedAt, id);
    }
    removeDocuments(documents) {
        this.db.transaction(() => {
            for (const document of documents) {
                const rowId = BigInt(document.id);
                this.deleteVector?.run(rowId);
                this.deleteFts.run(rowId);
                this.deleteMetadata.run(document.id);
                this.removeDocumentNodes(document.file_path);
            }
        })();
    }
    publish(input) {
        let publishedRowId = 0n;
        const structureJson = JSON.stringify(input.parsed.sections.map((section) => ({
            ...section,
            text: section.text.slice(0, 1200),
        })));
        this.db.transaction(() => {
            this.upsertMetadata.run(input.filePath, input.parsed.blk, input.parsed.codeRefs ? JSON.stringify(input.parsed.codeRefs) : null, input.parsed.docLinks ? JSON.stringify(input.parsed.docLinks) : null, input.parsed.summary, input.contentHash, input.parsed.format, input.parsed.title, structureJson, input.fileSize, input.modifiedAt);
            const row = this.selectId.get(input.filePath);
            publishedRowId = BigInt(row.id);
            this.deleteFts.run(publishedRowId);
            this.insertFts.run(publishedRowId, input.filePath, input.parsed.title ?? '', input.parsed.summary, input.parsed.embeddingText.slice(0, 20_000));
            this.deleteVector?.run(publishedRowId);
            this.removeDocumentNodes(input.filePath);
            if (input.publishConcepts)
                this.publishConceptNodes(input, Date.now());
        })();
        return publishedRowId;
    }
    publishEmbeddings(items) {
        if (!this.insertVector || !this.markEmbedded)
            return;
        this.db.transaction(() => {
            for (const item of items) {
                this.insertVector.run(item.rowId, (0, vec_1.floatBlob)(item.vector));
                this.markEmbedded.run(embed_1.EMBED_MODEL_ID, item.rowId);
            }
        })();
    }
    removeDocumentNodes(filePath) {
        const nodes = this.selectDocumentNodes.all(filePath);
        for (const node of nodes)
            this.deleteEdges.run(node.id, node.id);
        this.deleteDocumentNodes.run(filePath);
    }
    publishConceptNodes(input, now) {
        for (const tag of input.blkTags) {
            const nodeId = (0, crypto_1.createHash)('sha256').update(`${input.filePath}::${tag.tag}`).digest('hex').slice(0, 32);
            this.insertConcept.run(`concept:${nodeId}`, tag.tag, `${input.filePath}::${tag.tag}`, input.filePath, tag.line, tag.line, JSON.stringify({ format: input.parsed.format, section: tag.tag }), now);
        }
    }
}
exports.DocumentStore = DocumentStore;
//# sourceMappingURL=document-store.js.map