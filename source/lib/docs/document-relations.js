"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findGoverningDocs = findGoverningDocs;
exports.findBacklinks = findBacklinks;
const config_1 = require("./config");
const links_util_1 = require("./links-util");
const SUMMARY_CAP = 200;
function findGoverningDocs(db, filePaths) {
    if (!(0, config_1.resolveDocsEnabled)(db) || filePaths.length === 0)
        return [];
    const targets = filePaths.map(links_util_1.normPath).filter(Boolean);
    if (targets.length === 0)
        return [];
    try {
        const rows = db.prepare(`
      SELECT file_path, blk_tags, code_refs, content_summary
      FROM mdast_metadata WHERE code_refs IS NOT NULL
    `).all();
        const documents = [];
        for (const row of rows) {
            const codeRefs = (0, links_util_1.parseRefs)(row.code_refs);
            if (codeRefs.some((reference) => targets.some((target) => pathMatches(reference, target)))) {
                documents.push({
                    file: row.file_path,
                    blk: row.blk_tags,
                    summary: truncate(row.content_summary ?? '', SUMMARY_CAP),
                    codeRefs,
                });
            }
        }
        return documents;
    }
    catch {
        return [];
    }
}
function findBacklinks(db, filePath, maxDepth = 1) {
    if (!(0, config_1.resolveDocsEnabled)(db))
        return null;
    const target = (0, links_util_1.normPath)(filePath);
    if (!target)
        return null;
    try {
        const allDocs = db.prepare('SELECT file_path, doc_links FROM mdast_metadata').all();
        const basenameIndex = new Map(allDocs.map((row) => [(0, links_util_1.baseName)(row.file_path), row.file_path]));
        const docLinks = new Map(allDocs.map((row) => [row.file_path, (0, links_util_1.parseRefs)(row.doc_links)]));
        const visited = new Set([target]);
        const forwardLinks = [];
        let frontier = [target];
        for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
            const next = [];
            for (const current of frontier) {
                for (const link of docLinks.get(current) ?? []) {
                    const resolved = basenameIndex.get(link) ?? basenameIndex.get((0, links_util_1.baseName)(link)) ?? link;
                    if (visited.has(resolved))
                        continue;
                    visited.add(resolved);
                    forwardLinks.push(resolved);
                    next.push(resolved);
                }
            }
            frontier = next;
        }
        const targetBase = (0, links_util_1.baseName)(target);
        const backLinks = allDocs
            .filter((row) => row.file_path !== target)
            .filter((row) => (0, links_util_1.parseRefs)(row.doc_links).some((link) => (link === target || link === targetBase || (0, links_util_1.baseName)(link) === targetBase)))
            .map((row) => row.file_path);
        return { file: target, forwardLinks, backLinks };
    }
    catch {
        return null;
    }
}
function pathMatches(left, right) {
    const normalizedLeft = (0, links_util_1.normPath)(left);
    const normalizedRight = (0, links_util_1.normPath)(right);
    if (!normalizedLeft || !normalizedRight)
        return false;
    return normalizedLeft === normalizedRight
        || normalizedLeft.endsWith('/' + normalizedRight)
        || normalizedRight.endsWith('/' + normalizedLeft);
}
function truncate(value, cap) {
    return value.length > cap ? `${value.slice(0, cap).trimEnd()}…` : value;
}
//# sourceMappingURL=document-relations.js.map