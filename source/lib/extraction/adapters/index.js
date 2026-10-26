"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourceAdapterRegistry = exports.ptnAdapter = exports.extractPtn = exports.AdapterRegistry = void 0;
const registry_1 = require("./registry");
const ptn_1 = require("./ptn");
var registry_2 = require("./registry");
Object.defineProperty(exports, "AdapterRegistry", { enumerable: true, get: function () { return registry_2.AdapterRegistry; } });
var ptn_2 = require("./ptn");
Object.defineProperty(exports, "extractPtn", { enumerable: true, get: function () { return ptn_2.extractPtn; } });
Object.defineProperty(exports, "ptnAdapter", { enumerable: true, get: function () { return ptn_2.ptnAdapter; } });
exports.sourceAdapterRegistry = new registry_1.AdapterRegistry();
exports.sourceAdapterRegistry.register(ptn_1.ptnAdapter);
//# sourceMappingURL=index.js.map