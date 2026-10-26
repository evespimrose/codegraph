"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareText = compareText;
/** Locale-independent UTF-16 code-unit ordering for reproducible graph output. */
function compareText(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
//# sourceMappingURL=order.js.map