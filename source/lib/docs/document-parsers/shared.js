"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finishDocument = finishDocument;
exports.paragraphSection = paragraphSection;
exports.sectionId = sectionId;
exports.normalizeText = normalizeText;
function finishDocument(metadata, format, sections) {
    const highSignal = sections
        .filter((section) => section.text)
        .slice(0, 32)
        .map((section) => `${section.breadcrumb.join(' > ')}\n${section.title}\n${section.text}`.trim())
        .join('\n\n')
        .slice(0, 12_000);
    return {
        ...metadata,
        format,
        sections,
        embeddingText: `${metadata.title ?? ''}\n${metadata.summary}\n${highSignal}`.trim(),
    };
}
function paragraphSection(text, startLine, endLine) {
    const title = text.slice(0, 80);
    return { id: sectionId('paragraph', startLine, title), kind: 'paragraph', title, breadcrumb: [], startLine, endLine, text };
}
function sectionId(kind, line, title) {
    const slug = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 48);
    return `${kind}:${line}:${slug}`;
}
function normalizeText(value) {
    return value.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\s+/g, ' ').trim();
}
//# sourceMappingURL=shared.js.map