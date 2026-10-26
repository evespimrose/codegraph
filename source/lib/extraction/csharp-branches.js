"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConditionalVariants = getConditionalVariants;
exports.mergeConditionalResults = mergeConditionalResults;
const csharp_directives_1 = require("./csharp-directives");
const MAX_VARIANTS = 64;
const MAX_SEARCH_STEPS = 100000;

/**
 * Each variant applies one consistent set of defined symbols, so correlated
 * conditions such as `#if A` and `#if !A` never combine. Together the variants
 * activate every satisfiable non-empty branch; blanked directive lines and
 * inactive branches keep source positions.
 */
function getConditionalVariants(source) {
    const read = (0, csharp_directives_1.readDirectives)(source);
    if (read.error) return { error: read.error, variants: [] };
    const grouped = groupBranches(read.directives);
    if (grouped.error) return { error: grouped.error, variants: [] };
    if (!grouped.groups.length) return { variants: [] };
    return planVariants(source, grouped.groups, read.directives.map(directive => [directive.start, directive.end]));
}

function groupBranches(directives) {
    const groups = [];
    const stack = [];
    for (const { keyword, condition, start, end } of directives) {
        if (keyword === 'if') {
            const group = { parent: stack.at(-1)?.branches.at(-1) ?? null, branches: [] };
            group.branches.push({ group, index: 0, condition, range: [end, null] });
            groups.push(group);
            stack.push(group);
            continue;
        }
        const group = stack.at(-1);
        if (!group) return { error: 'C# conditional analysis found an unmatched branch directive.' };
        const last = group.branches.at(-1);
        if (!last.condition && keyword !== 'endif') return { error: 'C# conditional analysis found a branch after #else.' };
        last.range[1] = start;
        if (keyword === 'endif') stack.pop();
        else group.branches.push({ group, index: group.branches.length, condition, range: [end, null] });
    }
    return stack.length ? { error: 'C# conditional analysis found an unterminated #if.' } : { groups };
}

function planVariants(source, groups, directiveLines) {
    const branches = groups.flatMap(group => group.branches);
    for (const branch of branches) branch.requirements = requirementsOf(branch);
    const budget = { steps: MAX_SEARCH_STEPS };
    const variants = new Set();
    let pending = branches.filter(branch => /\S/.test(source.slice(...branch.range)));
    while (pending.length) {
        const assignment = new Map();
        for (const branch of pending) activate(branch.requirements, assignment, budget);
        if (budget.steps < 0) return { error: 'C# conditional analysis exceeds its condition search limit; extraction remains incomplete.', variants: [] };
        const remaining = pending.filter(branch => !isActive(branch, assignment));
        // Only an unsatisfiable first branch activates nothing; that code is never compiled.
        if (remaining.length === pending.length) {
            pending = remaining.slice(1);
            continue;
        }
        const inactive = branches.filter(branch => !isActive(branch, assignment)).map(branch => branch.range);
        variants.add(maskRanges(source, [...directiveLines, ...inactive]));
        if (variants.size > MAX_VARIANTS) return { error: `C# conditional analysis exceeds the ${MAX_VARIANTS}-variant limit; extraction remains incomplete.`, variants: [] };
        pending = remaining;
    }
    return { variants: [...variants] };
}

// A branch is active when every earlier sibling condition is false and its own condition is true, at every nesting level.
function requirementsOf(branch) {
    const requirements = [];
    for (let current = branch; current; current = current.group.parent) {
        for (const sibling of current.group.branches.slice(0, current.index)) requirements.push([sibling.condition, false]);
        if (current.condition) requirements.push([current.condition, true]);
    }
    return requirements;
}

function isActive(branch, assignment) {
    return branch.requirements.every(([condition, expected]) => (0, csharp_directives_1.evaluate)(condition, assignment, true) === expected);
}

// Extends the assignment in place until every requirement holds; on failure the assignment is left unchanged.
function activate(requirements, assignment, budget) {
    let open;
    for (const [condition, expected] of requirements) {
        const value = (0, csharp_directives_1.evaluate)(condition, assignment, false);
        if (value === undefined) open ??= condition;
        else if (value !== expected) return false;
    }
    if (!open) return true;
    if (--budget.steps < 0) return false;
    const symbol = (0, csharp_directives_1.firstUnassigned)(open, assignment);
    for (const value of [false, true]) {
        assignment.set(symbol, value);
        if (activate(requirements, assignment, budget)) return true;
    }
    assignment.delete(symbol);
    return false;
}

function maskRanges(source, ranges) {
    ranges.sort((left, right) => left[0] - right[0]);
    let cursor = 0;
    let result = '';
    for (const [start, end] of ranges) {
        if (end <= cursor) continue;
        result += source.slice(cursor, Math.max(cursor, start));
        result += source.slice(Math.max(cursor, start), end).replace(/[^\r\n]/g, ' ');
        cursor = end;
    }
    return result + source.slice(cursor);
}

function mergeConditionalResults(results, filePath) {
    const nodes = new Map();
    results.forEach((result, variant) => {
        for (const node of result.nodes) {
            const entry = nodes.get(node.id);
            if (entry) entry.variants.add(variant);
            else nodes.set(node.id, { node: { ...node }, variants: new Set([variant]) });
        }
    });
    const canonical = mergeVariantNodes(nodes);
    const resolve = id => canonical.get(id) ?? id;
    const edges = new Map();
    const references = new Map();
    const errors = new Map();
    for (const result of results) {
        for (const edge of result.edges) {
            const merged = { ...edge, source: resolve(edge.source), target: resolve(edge.target) };
            edges.set(JSON.stringify([merged.source, merged.target, merged.kind, merged.line, merged.column]), merged);
        }
        for (const reference of result.unresolvedReferences) {
            const merged = { ...reference, fromNodeId: resolve(reference.fromNodeId) };
            // Blanked text makes one multi-line reference name differ between variants only in whitespace.
            references.set(JSON.stringify({ ...merged, referenceName: merged.referenceName.replace(/\s+/g, ' ') }), merged);
        }
        for (const error of result.errors) errors.set(JSON.stringify(error), error);
    }
    return {
        nodes: [...nodes.values()].filter(entry => !canonical.has(entry.node.id)).map(entry => entry.node),
        edges: [...edges.values()], unresolvedReferences: [...references.values()],
        errors: [...errors.values(), { filePath, severity: 'warning', code: 'conditional_branches', message: `C# conditional compilation was analyzed in ${results.length} bounded variants; symbols and references include every explicit branch.` }],
        durationMs: results.reduce((total, result) => total + result.durationMs, 0),
    };
}

// A masked conditional attribute moves a declaration's first line and renumbers the attributes after it, and node IDs
// include both. Nodes of one kind and qualified name (without the attribute ordinal) from different variants whose
// lines overlap are one symbol; the earliest node keeps its ID.
function mergeVariantNodes(nodes) {
    const canonical = new Map();
    const groups = new Map();
    for (const entry of nodes.values()) {
        const { kind, qualifiedName } = entry.node;
        const key = `${kind}\0${kind === 'metadata' ? qualifiedName.replace(/:\d+$/, '') : qualifiedName}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
    }
    for (const group of groups.values()) clusterOverlapping(group, canonical);
    return canonical;
}

function clusterOverlapping(group, canonical) {
    group.sort((left, right) => left.node.startLine - right.node.startLine || left.node.startColumn - right.node.startColumn);
    let cluster = null;
    for (const entry of group) {
        const joins = cluster && entry.node.startLine <= cluster.node.endLine && ![...entry.variants].some(variant => cluster.variants.has(variant));
        if (!joins) {
            cluster = entry;
            continue;
        }
        canonical.set(entry.node.id, cluster.node.id);
        for (const variant of entry.variants) cluster.variants.add(variant);
        if (entry.node.endLine > cluster.node.endLine) Object.assign(cluster.node, { endLine: entry.node.endLine, endColumn: entry.node.endColumn });
    }
}
