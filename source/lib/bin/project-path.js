"use strict";
const fs = require('node:fs');
const path = require('node:path');
const { isInitialized } = require('../directory');

function resolveProjectPath(input) {
    const absolute = path.resolve(input || process.cwd());
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
        throw new Error(`Project directory does not exist: ${absolute}`);
    }
    const canonical = fs.realpathSync(absolute);
    if (input || isInitialized(canonical)) return canonical;
    let current = canonical;
    while (true) {
        if (isInitialized(current)) return current;
        if (fs.existsSync(path.join(current, '.git'))) return canonical;
        const parent = path.dirname(current);
        if (parent === current) return canonical;
        current = parent;
    }
}

module.exports = { resolveProjectPath };
