"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderGraphReport = renderGraphReport;
const report_sections_1 = require("./report-sections");
const MAX_REPORT_LINES = 399;
const MIN_REPORT_LINES = 20;
function renderGraphReport(data, options = {}) {
    const maxLines = Math.min(MAX_REPORT_LINES, Math.max(MIN_REPORT_LINES, options.maxLines ?? MAX_REPORT_LINES));
    const lines = [];
    for (const block of (0, report_sections_1.reportBlocks)(data, options)) {
        const required = block.length + (lines.length > 0 ? 1 : 0);
        if (lines.length + required > maxLines - 1) {
            if (lines.length < maxLines)
                lines.push('_Report truncated to the configured line budget._');
            break;
        }
        if (lines.length > 0)
            lines.push('');
        lines.push(...block);
    }
    return `${lines.slice(0, maxLines).join('\n')}\n`;
}
//# sourceMappingURL=report-render.js.map