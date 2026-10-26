"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDocument = parseDocument;
const html_1 = require("./document-parsers/html");
const markdown_1 = require("./document-parsers/markdown");
const text_1 = require("./document-parsers/text");
function parseDocument(raw, format) {
    if (format === 'markdown')
        return (0, markdown_1.parseMarkdownDocument)(raw);
    if (format === 'html')
        return (0, html_1.parseHtmlDocument)(raw);
    if (format === 'structured' || format === 'dsl')
        return (0, text_1.parseStructuredDocument)(raw, format);
    return (0, text_1.parseTextDocument)(raw);
}
//# sourceMappingURL=document-parser.js.map