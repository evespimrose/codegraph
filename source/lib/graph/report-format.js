"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markdown = markdown;
exports.table = table;
exports.communityChart = communityChart;
const MAX_CHART_EDGES = 20;
function oneLine(value) {
    return value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function markdown(value) {
    const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '|': '&#124;',
        '`': '&#96;',
        '[': '&#91;',
        ']': '&#93;',
        '%': '&#37;',
        ';': '&#59;',
        '\\': '&#92;',
        '*': '&#42;',
        '_': '&#95;',
        '#': '&#35;',
        '!': '&#33;',
        '(': '&#40;',
        ')': '&#41;',
    };
    return oneLine(value).replace(/[&<>|`\[\]%;\\*_#!()]/g, (character) => entities[character]);
}
function mermaid(value) {
    const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '%': '&#37;',
        ';': '&#59;',
        '{': '&#123;',
        '}': '&#125;',
        '[': '&#91;',
        ']': '&#93;',
        '|': '&#124;',
        '`': '&#96;',
    };
    return oneLine(value).replace(/[&<>"'%{};\[\]|`]/g, (character) => entities[character]);
}
function table(headers, rows) {
    if (rows.length === 0)
        return ['_None._'];
    return [
        `| ${headers.join(' | ')} |`,
        `| ${headers.map(() => '---').join(' | ')} |`,
        ...rows.map((row) => `| ${row.map(markdown).join(' | ')} |`),
    ];
}
function chartNodes(data, selected, aliases) {
    const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
    return selected.map((id) => {
        const node = nodeById.get(id);
        return `  ${aliases.get(id)}["${mermaid(`${node.name || id} (${node.kind})`)}"]`;
    });
}
function chartEdges(data, selected, aliases) {
    const lines = [];
    for (const edge of data.edges) {
        if (!selected.has(edge.source) || !selected.has(edge.target))
            continue;
        lines.push(`  ${aliases.get(edge.source)} -->|${mermaid(edge.kind)}| ${aliases.get(edge.target)}`);
        if (lines.length === MAX_CHART_EDGES)
            break;
    }
    return lines;
}
function communityChart(data, community, maxNodes) {
    const known = new Set(data.nodes.map((node) => node.id));
    const selected = community.members.slice(0, maxNodes).filter((id) => known.has(id));
    const aliases = new Map(selected.map((id, index) => [id, `n${index}`]));
    const lines = [
        '```mermaid',
        'flowchart LR',
        ...chartNodes(data, selected, aliases),
        ...chartEdges(data, new Set(selected), aliases),
        '```',
    ];
    if (community.members.length > selected.length) {
        lines.push(`_${community.members.length - selected.length} more nodes omitted._`);
    }
    return lines;
}
//# sourceMappingURL=report-format.js.map