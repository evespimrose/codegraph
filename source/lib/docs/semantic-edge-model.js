"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEMANTIC_EDGE_ALGORITHM = void 0;
exports.documentNodeId = documentNodeId;
exports.decodeVector = decodeVector;
exports.cosine = cosine;
exports.fingerprintCorpus = fingerprintCorpus;
exports.fingerprintDocument = fingerprintDocument;
exports.hashValue = hashValue;
const crypto_1 = require("crypto");
const links_util_1 = require("./links-util");
exports.SEMANTIC_EDGE_ALGORITHM = 'semantic-edges-v2';
function documentNodeId(filePath) {
    return (0, crypto_1.createHash)('sha1').update(`doc::${(0, links_util_1.normPath)(filePath)}`).digest('hex');
}
function decodeVector(bytes) {
    if (bytes.byteLength === 0 || bytes.byteLength % 4 !== 0) {
        throw new Error(`Invalid embedding byte length: ${bytes.byteLength}`);
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const vector = new Float32Array(bytes.byteLength / 4);
    for (let index = 0; index < vector.length; index++) {
        const value = view.getFloat32(index * 4, true);
        if (!Number.isFinite(value))
            throw new Error('Embedding contains a non-finite value.');
        vector[index] = value;
    }
    return vector;
}
function cosine(left, right) {
    if (left.length !== right.length)
        throw new Error('Embedding dimensions do not match.');
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < left.length; index++) {
        const leftValue = left[index];
        const rightValue = right[index];
        dot += leftValue * rightValue;
        leftNorm += leftValue * leftValue;
        rightNorm += rightValue * rightValue;
    }
    if (leftNorm === 0 || rightNorm === 0)
        return 0;
    return Math.max(-1, Math.min(1, dot / Math.sqrt(leftNorm * rightNorm)));
}
function fingerprintCorpus(documents) {
    const digest = (0, crypto_1.createHash)('sha256');
    for (const document of documents) {
        digest.update(String(document.id));
        digest.update('\0');
        digest.update(document.filePath);
        digest.update('\0');
        digest.update(document.contentHash);
        digest.update('\0');
        digest.update(document.blob);
        digest.update('\0');
    }
    return digest.digest('hex');
}
function fingerprintDocument(document) {
    const digest = (0, crypto_1.createHash)('sha256');
    digest.update(String(document.id));
    digest.update('\0');
    digest.update(document.filePath);
    digest.update('\0');
    digest.update(document.contentHash);
    digest.update('\0');
    digest.update(document.blob);
    return digest.digest('hex');
}
function hashValue(value) {
    return (0, crypto_1.createHash)('sha256').update(value).digest('hex');
}
//# sourceMappingURL=semantic-edge-model.js.map