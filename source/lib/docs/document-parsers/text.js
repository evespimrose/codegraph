"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStructuredDocument = parseStructuredDocument;
exports.parseTextDocument = parseTextDocument;
const shared_1 = require("./shared");
function parseStructuredDocument(raw, format) {
    const lines = raw.split(/\r?\n/);
    const sections = [];
    const entryPattern = format === 'dsl'
        ? /^\s*(component|struct|command|event|enum|input)\s*([A-Za-z_][\w.]*)?/
        : /^\s*["']?([A-Za-z_][\w.-]*)["']?\s*[:=]/;
    for (let index = 0; index < lines.length; index++) {
        const match = lines[index].match(entryPattern);
        if (!match)
            continue;
        const title = format === 'dsl' ? [match[1], match[2]].filter(Boolean).join(' ') : match[1];
        sections.push({
            id: (0, shared_1.sectionId)('entry', index + 1, title),
            kind: 'entry',
            title,
            breadcrumb: [],
            startLine: index + 1,
            endLine: index + 1,
            text: (0, shared_1.normalizeText)(lines[index]),
        });
    }
    const summary = (0, shared_1.normalizeText)(raw).slice(0, 600);
    if (sections.length === 0 && summary)
        sections.push((0, shared_1.paragraphSection)(summary, 1, lines.length));
    return (0, shared_1.finishDocument)({ blk: null, title: sections[0]?.title ?? null, summary, codeRefs: null, docLinks: null }, format, sections);
}
function parseTextDocument(raw) {
    const lines = raw.split(/\r?\n/);
    const sections = [];
    let paragraph = [];
    let startLine = 1;
    const flush = (endLine) => {
        const text = (0, shared_1.normalizeText)(paragraph.join('\n'));
        if (text)
            sections.push((0, shared_1.paragraphSection)(text, startLine, endLine));
        paragraph = [];
    };
    for (let index = 0; index < lines.length; index++) {
        if (!lines[index].trim()) {
            flush(index + 1);
            startLine = index + 2;
        }
        else {
            paragraph.push(lines[index]);
        }
    }
    flush(lines.length);
    const summary = (0, shared_1.normalizeText)(raw).slice(0, 600);
    return (0, shared_1.finishDocument)({
        blk: null,
        title: sections[0]?.text.slice(0, 80) ?? null,
        summary,
        codeRefs: null,
        docLinks: null,
    }, 'text', sections);
}
//# sourceMappingURL=text.js.map