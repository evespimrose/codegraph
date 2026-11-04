"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSearchTuning = loadSearchTuning;
exports.resetSearchTuning = resetSearchTuning;
const fs = require("fs");
const path = require("path");
const TUNING_FILE = path.join(__dirname, 'search-tuning.json');
let cached = null;
// 측정 도구가 같은 빌드에서 값을 바꿔 비교하도록 환경 변수가 파일 값을 덮어씀
function loadSearchTuning() {
    if (cached)
        return cached;
    const base = JSON.parse(fs.readFileSync(TUNING_FILE, 'utf8'));
    cached = {
        docsFtsWeights: weights(process.env.CODEGRAPH_DOCS_FTS_WEIGHTS, base.docsFtsWeights, 4),
        docsLexicalWeight: number(process.env.CODEGRAPH_DOCS_LEXICAL_WEIGHT, base.docsLexicalWeight, 1),
        docsLexicalWeightHangul: number(process.env.CODEGRAPH_DOCS_LEXICAL_WEIGHT_HANGUL, base.docsLexicalWeightHangul, 1),
        docsMarkdownFirst: flag(process.env.CODEGRAPH_DOCS_MARKDOWN_FIRST, base.docsMarkdownFirst),
        docsMarkdownDepth: number(process.env.CODEGRAPH_DOCS_MARKDOWN_DEPTH, base.docsMarkdownDepth, 50),
        nameTokensWeight: number(process.env.CODEGRAPH_NAME_TOKENS_WEIGHT, base.nameTokensWeight, 10),
    };
    return cached;
}
function resetSearchTuning() {
    cached = null;
}
function number(envValue, fileValue, fallback) {
    for (const value of [envValue, fileValue]) {
        if (value === undefined || value === null || value === '')
            continue;
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= 0)
            return parsed;
    }
    return fallback;
}
function flag(envValue, fileValue) {
    if (envValue !== undefined && envValue !== '')
        return /^(1|true|yes|on)$/i.test(envValue);
    return fileValue === true;
}
function weights(envValue, fileValue, count) {
    const source = envValue !== undefined && envValue !== '' ? String(envValue).split(',') : fileValue;
    const fallback = new Array(count).fill(1);
    if (!Array.isArray(source) || source.length !== count)
        return fallback;
    const parsed = source.map(Number);
    return parsed.every((value) => Number.isFinite(value) && value >= 0) ? parsed : fallback;
}
