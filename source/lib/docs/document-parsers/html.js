"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseHtmlDocument = parseHtmlDocument;
const shared_1 = require("./shared");
function parseHtmlDocument(raw) {
    const sanitized = raw
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
    const titleMatch = sanitized.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const sections = [];
    const lineStarts = buildLineStarts(sanitized);
    const headingPattern = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
    const headings = [];
    const matches = [...sanitized.matchAll(headingPattern)];
    for (let index = 0; index < matches.length; index++) {
        const match = matches[index];
        const level = Number(match[1]);
        const title = htmlText(match[2] ?? '');
        headings.splice(level - 1);
        headings[level - 1] = { level, title };
        const start = match.index ?? 0;
        const end = matches[index + 1]?.index ?? sanitized.length;
        const text = htmlText(sanitized.slice(start + match[0].length, end));
        const startLine = lineAt(lineStarts, start);
        sections.push({
            id: (0, shared_1.sectionId)('section', startLine, title),
            kind: 'section',
            title,
            breadcrumb: headings.map((heading) => heading.title),
            startLine,
            endLine: lineAt(lineStarts, end),
            text,
        });
    }
    if (sections.length === 0) {
        const text = htmlText(sanitized);
        if (text)
            sections.push((0, shared_1.paragraphSection)(text, 1, sanitized.split(/\r?\n/).length));
    }
    const title = htmlText(titleMatch?.[1] ?? '') || sections[0]?.title || null;
    return (0, shared_1.finishDocument)({
        blk: null,
        title,
        summary: htmlText(sanitized).slice(0, 600),
        codeRefs: null,
        docLinks: extractHtmlLinks(sanitized),
    }, 'html', sections);
}
function htmlText(value) {
    return (0, shared_1.normalizeText)(value
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'"));
}
function extractHtmlLinks(value) {
    const links = [...value.matchAll(/\bhref\s*=\s*["']([^"'#][^"']*)["']/gi)]
        .map((match) => match[1].split('#')[0].trim())
        .filter((link) => link && !/^[a-z]+:/i.test(link));
    return links.length > 0 ? [...new Set(links)] : null;
}
function buildLineStarts(value) {
    const starts = [0];
    for (let index = 0; index < value.length; index++) {
        if (value.charCodeAt(index) === 10)
            starts.push(index + 1);
    }
    return starts;
}
function lineAt(starts, index) {
    let low = 0;
    let high = starts.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (starts[middle] <= index)
            low = middle + 1;
        else
            high = middle;
    }
    return Math.max(1, low);
}
//# sourceMappingURL=html.js.map