"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nameTokens = nameTokens;
// FTS5 기본 토크나이저는 DamageHitJob 을 한 토큰으로 봐서 가운데 낱말(hit)로 찾지 못함
function nameTokens(name) {
    if (!name)
        return null;
    const words = String(name)
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/([A-Za-z])([0-9])/g, '$1 $2')
        .split(/[^\p{L}\p{N}]+/u)
        .map((word) => word.toLowerCase())
        .filter(Boolean);
    if (words.length < 2)
        return null;
    return [...new Set(words)].join(' ');
}
