"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadingTokenIds = leadingTokenIds;
const START_CHARS = 1200;
// 공백 없는 긴 글을 중간에서 잘라 경계 토큰이 흔들려도 앞 maxTokens 개는 안 바뀌게 하는 여유
const MARGIN_TOKENS = 32;
// 토큰 밀도 추정이 조금 빗나가도 한 번에 끝나게 붙이는 배율
const HEADROOM = 1.1;
const WHITESPACE_SEARCH_CHARS = 256;
const WHITESPACE = /\s/;
/**
 * First `maxTokens` ids of the tokenized `text`, tokenizing only as much leading text as needed.
 * @param tokenize maps a string to its full id list, special tokens included and nothing truncated
 */
function leadingTokenIds(tokenize, text, maxTokens) {
    const wanted = maxTokens + MARGIN_TOKENS;
    let cap = START_CHARS;
    for (;;) {
        const whole = cap >= text.length;
        const ids = tokenize(whole ? text : cutAtWhitespace(text, cap));
        if (whole || ids.length > wanted) {
            // 라이브러리의 잘라내기는 끝의 </s> 도 버리므로 같게 앞 maxTokens 개만 씀
            return ids.length > maxTokens ? ids.slice(0, maxTokens) : ids;
        }
        cap = Math.ceil(cap * wanted / ids.length * HEADROOM);
    }
}
function cutAtWhitespace(text, cap) {
    const floor = Math.max(0, cap - WHITESPACE_SEARCH_CHARS);
    for (let index = cap; index > floor; index--) {
        if (WHITESPACE.test(text[index]))
            return text.slice(0, index);
    }
    return text.slice(0, cap);
}
