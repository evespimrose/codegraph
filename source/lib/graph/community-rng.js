"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seededRandom = seededRandom;
function seededRandom(seed, salt = '') {
    const input = `${seed}:${salt}`;
    let state = 2166136261;
    for (let index = 0; index < input.length; index++) {
        state ^= input.charCodeAt(index);
        state = Math.imul(state, 16777619);
    }
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}
//# sourceMappingURL=community-rng.js.map