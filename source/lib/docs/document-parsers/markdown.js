"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMarkdownDocument = parseMarkdownDocument;
const parse_1 = require("../parse");
const shared_1 = require("./shared");
function parseMarkdownDocument(raw) {
    const metadata = (0, parse_1.parseDoc)(raw);
    const lines = raw.split(/\r?\n/);
    const sections = [];
    const headings = [];
    let currentStart = 1;
    let currentTitle = metadata.title ?? 'Document';
    let currentLines = [];
    let fenceStart = 0;
    let fenceMarker = '';
    let fenceLanguage = '';
    let fenceLines = [];
    const frontmatterEnd = lines[0]?.trim() === '---'
        ? lines.findIndex((line, index) => index > 0 && line.trim() === '---')
        : -1;
    const flushSection = (endLine) => {
        const text = (0, shared_1.normalizeText)(currentLines.join('\n'));
        if (text) {
            sections.push({
                id: (0, shared_1.sectionId)('section', currentStart, currentTitle),
                kind: 'section',
                title: currentTitle,
                breadcrumb: headings.map((heading) => heading.title),
                startLine: currentStart,
                endLine,
                text,
            });
        }
        currentLines = [];
    };
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const lineNumber = index + 1;
        if (frontmatterEnd >= 0 && index <= frontmatterEnd) {
            currentStart = frontmatterEnd + 2;
            continue;
        }
        const fence = line.match(/^\s*(```|~~~)\s*([^\s`]*)/);
        if (fence && (!fenceMarker || fence[1] === fenceMarker)) {
            if (!fenceMarker) {
                flushSection(lineNumber - 1);
                fenceMarker = fence[1];
                fenceStart = lineNumber;
                fenceLanguage = fence[2] ?? '';
                fenceLines = [];
            }
            else {
                sections.push({
                    id: (0, shared_1.sectionId)('code', fenceStart, fenceLanguage || 'code'),
                    kind: 'code',
                    title: fenceLanguage || 'code',
                    breadcrumb: headings.map((heading) => heading.title),
                    startLine: fenceStart,
                    endLine: lineNumber,
                    text: fenceLines.join('\n').trim(),
                    language: fenceLanguage || undefined,
                });
                fenceMarker = '';
                currentStart = lineNumber + 1;
            }
            continue;
        }
        if (fenceMarker) {
            fenceLines.push(line);
            continue;
        }
        const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
        if (heading) {
            flushSection(lineNumber - 1);
            const level = heading[1].length;
            headings.splice(level - 1);
            headings[level - 1] = { level, title: heading[2].trim() };
            currentTitle = heading[2].trim();
            currentStart = lineNumber;
            continue;
        }
        if (!/^---\s*$/.test(line) && !/^\s*<!--[\s\S]*-->\s*$/.test(line))
            currentLines.push(line);
    }
    flushSection(lines.length);
    if (fenceMarker && fenceLines.length > 0) {
        sections.push({
            id: (0, shared_1.sectionId)('code', fenceStart, fenceLanguage || 'code'),
            kind: 'code',
            title: fenceLanguage || 'code',
            breadcrumb: headings.map((heading) => heading.title),
            startLine: fenceStart,
            endLine: lines.length,
            text: fenceLines.join('\n').trim(),
            language: fenceLanguage || undefined,
        });
    }
    return (0, shared_1.finishDocument)(metadata, 'markdown', sections);
}
//# sourceMappingURL=markdown.js.map