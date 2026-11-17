"use strict";
const fs = require('node:fs');
const { isInitialized } = require('../directory');
const { syncForRead } = require('./freshness');
const { resolveProjectPath } = require('./project-path');
const { lookup, collect } = require('./traversal-command');

const PREFIXED_KINDS = ['context', 'callers', 'callees', 'impact', 'docs', 'backlinks', 'files', 'affected'];
const DEFAULT_LIMIT = { search: '10', docs: '10', callers: '20', callees: '20' };
const DEFAULT_DEPTH = { impact: '2', backlinks: '1', affected: '5' };
const THIN_THRESHOLD = 3;
const DEFAULT_TEST_PATTERNS = [
    /\.spec\./,
    /\.test\./,
    /\/__tests__\//,
    /\/tests?\//,
    /\/e2e\//,
    /\/spec\//,
    /(?:Tests?|Specs?)\.(?:cs|java)$/i,
];

function messageOf(caught) {
    return caught instanceof Error ? caught.message : String(caught);
}

// 첫 `:` 앞이 질의 종류 이름이고 바로 뒤가 `:` 가 아닐 때만 접두어로 봄. `dbNode::First` 는 검색어로 남음
function parseItem(text) {
    const colon = text.indexOf(':');
    const prefix = colon > 0 ? text.slice(0, colon) : '';
    if (PREFIXED_KINDS.includes(prefix) && text[colon + 1] !== ':') {
        return { kind: prefix, input: text.slice(colon + 1).trim() };
    }
    return { kind: 'search', input: text.trim() };
}

function parseInputLines(text) {
    const items = [];
    text.split(/\r?\n/).forEach((raw, index) => {
        const line = raw.trim();
        if (!line)
            return;
        if (!line.startsWith('{')) {
            items.push({ id: null, ...parseItem(line), options: {} });
            return;
        }
        let entry;
        try {
            entry = JSON.parse(line);
        }
        catch {
            throw new Error(`line ${index + 1}: invalid JSON query`);
        }
        if (typeof entry.q !== 'string')
            throw new Error(`line ${index + 1}: "q" is required`);
        const { id = null, kind, q, ...options } = entry;
        if (kind === undefined) {
            items.push({ id, ...parseItem(q), options });
            return;
        }
        if (kind !== 'search' && !PREFIXED_KINDS.includes(kind))
            throw new Error(`line ${index + 1}: unknown kind "${kind}"`);
        items.push({ id, kind, input: q.trim(), options });
    });
    return items;
}

function setting(item, options, key, fallback) {
    if (item.options[key] !== undefined)
        return item.options[key];
    if (options[key] !== undefined)
        return options[key];
    return fallback;
}

function integer(value, name) {
    const number = Number.parseInt(String(value), 10);
    if (!Number.isInteger(number))
        throw new Error(`${name} must be an integer`);
    return number;
}

function requireInput(item) {
    if (!item.input)
        throw new Error('empty query');
}

function semanticStateOnce(graph) {
    let pending;
    return () => {
        pending ??= (async () => {
            const { resolveDocsEnabled } = require('../docs/config');
            if (!resolveDocsEnabled(graph.getDb()))
                return 'disabled';
            const { isEmbedAvailable } = require('../docs/embed');
            const { loadVecExtension } = require('../docs/vec');
            return loadVecExtension(graph.getDb()) && await isEmbedAvailable() ? 'ready' : 'unavailable';
        })();
        return pending;
    };
}

async function runSearch(context, item) {
    const { graph, cli, options } = context;
    requireInput(item);
    const limit = integer(setting(item, options, 'limit', DEFAULT_LIMIT.search), 'limit');
    const nodeKind = item.options.nodeKind ?? options.kind;
    const rawResults = await graph.searchNodesHybrid(item.input, { limit, kinds: nodeKind ? [nodeKind] : undefined });
    const { isGeneratedFile } = require('../extraction/generated-detection');
    // 이름이 같으면 protobuf·gRPC 생성 파일보다 손으로 쓴 구현을 앞에 둠
    const results = [...rawResults].sort((a, b) => (isGeneratedFile(a.node.filePath) ? 1 : 0) - (isGeneratedFile(b.node.filePath) ? 1 : 0));
    let semanticState = await context.semanticState();
    let docs = [];
    const warnings = [];
    // 검색 결과가 적을 때만 문서 검색을 덧붙임. 임베딩 모델 기동 비용은 이 경로에서만 냄
    if (rawResults.length < THIN_THRESHOLD) {
        try {
            const { searchDocs } = require('../docs/search');
            const docResult = await searchDocs(graph.getDb(), item.input, { topk: limit });
            docs = docResult.hits;
            semanticState = docResult.semanticState;
            warnings.push(...docResult.warnings);
        }
        catch (fallbackError) {
            warnings.push(`Document fallback failed: ${messageOf(fallbackError)}`);
        }
    }
    return { fields: { semanticState, results, docs }, warnings, render: () => printSearch(cli, item.input, results, docs) };
}

async function runContext(context, item) {
    const { graph, options } = context;
    requireInput(item);
    const semanticState = await context.semanticState();
    const built = await graph.buildContext(item.input, {
        maxNodes: integer(setting(item, options, 'maxNodes'), 'maxNodes'),
        maxCodeBlocks: integer(setting(item, options, 'maxCode'), 'maxCode'),
        includeCode: setting(item, options, 'code') !== false,
        format: options.json ? 'json' : 'markdown',
        tokenBudget: integer(setting(item, options, 'budget'), 'budget'),
        freshness: context.freshness,
        semanticState,
        warnings: [...new Set(context.syncWarnings)],
    });
    if (options.json)
        return { fields: { context: JSON.parse(built) }, warnings: [], render: null };
    return { fields: {}, warnings: [], render: () => console.log(built) };
}

function runTraversal(context, item) {
    const { graph, options } = context;
    requireInput(item);
    const matches = lookup(graph, item.input);
    const fields = {
        symbol: item.input,
        found: matches.length > 0,
        ...collect(graph, matches, item.kind, {
            depth: setting(item, options, 'depth', DEFAULT_DEPTH.impact),
            limit: setting(item, options, 'limit', DEFAULT_LIMIT[item.kind]),
        }),
    };
    return {
        fields,
        warnings: [],
        render: () => {
            const related = fields[item.kind] || fields.affected;
            console.log(`${item.kind} of ${item.input}: ${related.length}`);
            for (const node of related)
                console.log(`${node.qualifiedName || node.name}  ${node.filePath}:${node.startLine}`);
        },
    };
}

async function runDocs(context, item) {
    const { graph, cli, options } = context;
    requireInput(item);
    const limit = integer(setting(item, options, 'limit', DEFAULT_LIMIT.docs), 'limit');
    const { searchDocs } = require('../docs/search');
    const result = await searchDocs(graph.getDb(), item.input, cli.docsSearchOptions(limit, {
        rerank: setting(item, options, 'rerank'),
        rerankDepth: setting(item, options, 'rerankDepth'),
    }));
    const warnings = result.warnings;
    delete result.warnings;
    delete result.schemaVersion;
    return { fields: result, warnings, render: () => printDocs(cli, item.input, result) };
}

function runBacklinks(context, item) {
    const { graph, cli, options } = context;
    requireInput(item);
    const { findBacklinks } = require('../docs/search');
    const depth = integer(setting(item, options, 'depth', DEFAULT_DEPTH.backlinks), 'depth');
    const found = findBacklinks(graph.getDb(), item.input, depth);
    return {
        fields: found ?? { file: item.input, forwardLinks: [], backLinks: [] },
        warnings: [],
        render: () => printBacklinks(cli, found),
    };
}

function runFiles(context, item) {
    const { graph, cli, options } = context;
    const indexed = graph.getFiles();
    let files = indexed;
    const filter = setting(item, options, 'filter');
    if (filter)
        files = files.filter(file => file.path.startsWith(filter) || file.path.startsWith('./' + filter));
    if (item.input) {
        const regex = cli.globToRegex(item.input);
        files = files.filter(file => regex.test(file.path));
    }
    const maxDepth = setting(item, options, 'maxDepth');
    const layout = {
        format: setting(item, options, 'format'),
        includeMetadata: setting(item, options, 'metadata') !== false,
        maxDepth: maxDepth === undefined ? undefined : integer(maxDepth, 'maxDepth'),
    };
    return {
        fields: { files: files.map(file => ({ path: file.path, language: file.language, nodeCount: file.nodeCount, size: file.size })) },
        warnings: [],
        render: () => printFiles(cli, files, indexed.length, layout),
    };
}

function testFileMatcher(testFilter) {
    if (!testFilter)
        return filePath => DEFAULT_TEST_PATTERNS.some(pattern => pattern.test(filePath));
    const custom = new RegExp(testFilter
        .replace(/[+[\]{}()^$|\\]/g, '\\$&')
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.+')
        .replace(/\*/g, '[^/]*'));
    return filePath => custom.test(filePath);
}

function walkDependents(graph, start, maxDepth, isTestFile) {
    const visited = new Set([start]);
    const reached = [];
    const queue = [{ file: start, depth: 0 }];
    while (queue.length > 0) {
        const current = queue.shift();
        if (current.depth >= maxDepth)
            continue;
        const fresh = [...new Set(graph.getFileDependents(current.file))].filter(dependent => !visited.has(dependent));
        fresh.forEach(dependent => visited.add(dependent));
        reached.push(...fresh);
        queue.push(...fresh.filter(dependent => !isTestFile(dependent)).map(file => ({ file, depth: current.depth + 1 })));
    }
    return reached;
}

function runAffected(context, item) {
    const { graph, cli, options } = context;
    const changedFiles = item.input.split(',').map(file => file.trim()).filter(Boolean);
    const maxDepth = integer(setting(item, options, 'depth', DEFAULT_DEPTH.affected), 'depth');
    const isTestFile = testFileMatcher(setting(item, options, 'testFilter'));
    const affectedTests = new Set();
    const allDependents = new Set();
    for (const file of changedFiles) {
        if (isTestFile(file)) {
            affectedTests.add(file);
            continue;
        }
        const reached = walkDependents(graph, file, maxDepth, isTestFile);
        for (const dependent of reached)
            allDependents.add(dependent);
        for (const test of reached.filter(isTestFile))
            affectedTests.add(test);
    }
    const fields = { changedFiles, affectedTests: [...affectedTests].sort(), totalDependentsTraversed: allDependents.size };
    return { fields, warnings: [], render: () => printAffected(cli, fields) };
}

const HANDLERS = {
    search: runSearch,
    context: runContext,
    callers: runTraversal,
    callees: runTraversal,
    impact: runTraversal,
    docs: runDocs,
    backlinks: runBacklinks,
    files: runFiles,
    affected: runAffected,
};

function printSearch(cli, search, results, docs) {
    const { chalk } = cli;
    if (results.length === 0 && docs.length === 0) {
        cli.info(`No results found for "${search}"`);
        return;
    }
    if (results.length > 0) {
        console.log(chalk.bold(`\nSearch Results for "${search}":\n`));
        for (const result of results) {
            const node = result.node;
            const score = chalk.dim(`(${(result.score * 100).toFixed(0)}%)`);
            console.log(chalk.cyan(node.kind.padEnd(12)) + chalk.white(node.name) + ' ' + score);
            console.log(chalk.dim(`  ${node.filePath}:${node.startLine}`));
            if (node.signature)
                console.log(chalk.dim(`  ${node.signature}`));
            console.log();
        }
    }
    if (docs.length > 0) {
        console.log(chalk.bold(`\nRelated documentation for "${search}":\n`));
        for (const hit of docs) {
            const blk = hit.blk ? ' ' + chalk.dim(`[${hit.blk}]`) : '';
            console.log(chalk.blue('doc'.padEnd(12)) + chalk.white(hit.file) + blk);
            if (hit.summary)
                console.log(chalk.dim(`  ${hit.summary}`));
            console.log();
        }
    }
}

function printDocs(cli, query, result) {
    const { chalk } = cli;
    if (!result.enabled) {
        cli.info('Docs feature is not enabled for this project (index with --with-docs).');
        return;
    }
    if (result.hits.length === 0) {
        cli.info(`No documentation matches for "${query}".`);
        return;
    }
    console.log(chalk.bold(`\nDocumentation matches for "${query}":\n`));
    for (const hit of result.hits) {
        const blk = hit.blk ? ' ' + chalk.dim(`[${hit.blk}]`) : '';
        console.log(chalk.blue('doc'.padEnd(12)) + chalk.white(hit.file) + blk + ' ' + chalk.dim(`(d=${hit.distance})`));
        if (hit.summary)
            console.log(chalk.dim(`  ${hit.summary}`));
        console.log();
    }
}

function printBacklinks(cli, found) {
    const { chalk } = cli;
    if (!found) {
        cli.info('Docs graph is not enabled for this project (enable with --with-docs or CODEGRAPH_DOC_GRAPH).');
        return;
    }
    console.log(chalk.bold(`\nBacklinks for ${found.file}:\n`));
    if (found.backLinks.length === 0)
        cli.info('No backlinks found.');
    else
        for (const link of found.backLinks)
            console.log('  ' + chalk.cyan('<-') + ' ' + link);
    if (found.forwardLinks.length > 0) {
        console.log(chalk.bold('\nForward links:\n'));
        for (const link of found.forwardLinks)
            console.log('  ' + chalk.blue('->') + ' ' + link);
    }
    console.log();
}

function printGroupedFiles(chalk, files, includeMetadata) {
    console.log(chalk.bold(`\nFiles by Language (${files.length} total):\n`));
    const byLanguage = new Map();
    for (const file of files) {
        const group = byLanguage.get(file.language) ?? [];
        group.push(file);
        byLanguage.set(file.language, group);
    }
    for (const [language, languageFiles] of [...byLanguage.entries()].sort((a, b) => b[1].length - a[1].length)) {
        console.log(chalk.cyan(`${language} (${languageFiles.length}):`));
        for (const file of languageFiles.sort((a, b) => a.path.localeCompare(b.path)))
            console.log(includeMetadata ? `  ${file.path} ${chalk.dim(`(${file.nodeCount} symbols)`)}` : `  ${file.path}`);
        console.log();
    }
}

function printFiles(cli, files, indexedCount, layout) {
    const { chalk } = cli;
    if (indexedCount === 0) {
        cli.info(`No files indexed. Run "${cli.cliName} index" first.`);
        return;
    }
    if (files.length === 0) {
        cli.info('No files found matching the criteria.');
        return;
    }
    if (layout.format === 'flat') {
        console.log(chalk.bold(`\nFiles (${files.length}):\n`));
        for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path)))
            console.log(layout.includeMetadata ? `  ${file.path} ${chalk.dim(`(${file.language}, ${file.nodeCount} symbols)`)}` : `  ${file.path}`);
    }
    else if (layout.format === 'grouped')
        printGroupedFiles(chalk, files, layout.includeMetadata);
    else {
        console.log(chalk.bold(`\nProject Structure (${files.length} files):\n`));
        cli.printFileTree(files, layout.includeMetadata, layout.maxDepth, chalk);
    }
    console.log();
}

function printAffected(cli, fields) {
    const { chalk } = cli;
    if (fields.changedFiles.length === 0) {
        cli.info('No files provided.');
        return;
    }
    if (fields.affectedTests.length === 0) {
        cli.info('No test files affected by the changed files.');
        return;
    }
    console.log(chalk.bold(`\nAffected test files (${fields.affectedTests.length}):\n`));
    for (const test of fields.affectedTests)
        console.log('  ' + chalk.cyan(test));
    console.log();
}

function readItems(texts, options) {
    const items = texts.map(text => ({ id: null, ...parseItem(text), options: {} }));
    // stdin 은 `-i -` 일 때만 읽음. 항목 없이 부른 터미널이 입력 대기에 걸리지 않게 함
    if (options.input)
        items.push(...parseInputLines(fs.readFileSync(options.input === '-' ? 0 : options.input, 'utf8')));
    if (items.length === 0)
        throw new Error('query needs at least one item');
    return items;
}

async function syncBatch(cli, graph, projectPath, items, options) {
    if (options.sync === false)
        return { freshness: cli.unknownFreshness(), syncWarnings: [] };
    // context 는 getDominantFile 저장값을 읽으므로 묶음에 context 가 있을 때만 이 sync 에서 갱신함
    const sync = await syncForRead(graph, projectPath, items.some(item => item.kind === 'context') ? { refreshDominant: true } : {});
    if (sync.status !== 'current')
        process.exitCode = 1;
    return { freshness: cli.syncFreshness(sync), syncWarnings: sync.warnings ?? [] };
}

async function answerItems(context, items) {
    const warnings = [...context.syncWarnings];
    const answers = [];
    for (const [index, item] of items.entries()) {
        const base = { index, id: item.id, kind: item.kind, input: item.input };
        try {
            const answer = await HANDLERS[item.kind](context, item);
            warnings.push(...answer.warnings);
            answers.push({ base, fields: answer.fields, render: answer.render });
        }
        catch (caught) {
            process.exitCode = 1;
            answers.push({ base, error: messageOf(caught) });
        }
    }
    return { answers, warnings: [...new Set(warnings)] };
}

function printAnswers(cli, answers, warnings) {
    for (const answer of answers) {
        console.log(cli.chalk.bold(`\n[${answer.base.index + 1}] ${answer.base.kind}: ${answer.base.input}`));
        if (answer.error)
            console.error(answer.error);
        else
            answer.render();
    }
    for (const warning of warnings)
        console.error(warning);
}

function addQuery(program, cli) {
    program
        .command('query [items...]')
        .description('Answer 1..n queries with one freshness check. Plain items search symbols; prefix an item with context:, callers:, callees:, impact:, docs:, backlinks:, files: or affected:')
        .option('-p, --path <path>', 'Project path')
        .option('-i, --input <file>', 'Read more items from a file, one per line ("-" reads stdin)')
        .option('-l, --limit <number>', 'Maximum results (search and docs 10, callers and callees 20)')
        .option('-k, --kind <kind>', 'Filter search results by node kind (function, class, etc.)')
        .option('-d, --depth <number>', 'Traversal depth (impact 2, backlinks 1, affected 5)')
        .option('-n, --max-nodes <number>', 'context: maximum nodes to include', '50')
        .option('-c, --max-code <number>', 'context: maximum code blocks', '10')
        .option('-b, --budget <tokens>', 'context: approximate output token budget', '4000')
        .option('--no-code', 'context: exclude code blocks')
        .option('--rerank', 'docs: re-rank the top candidates with the cross-encoder (also CODEGRAPH_DOCS_RERANK=1)')
        .option('--rerank-depth <number>', 'docs: candidates passed to the re-ranker', '10')
        .option('--filter <dir>', 'files: only files under this directory')
        .option('--format <format>', 'files: text layout (tree, flat, grouped)', 'tree')
        .option('--max-depth <number>', 'files: maximum directory depth for the tree layout')
        .option('--no-metadata', 'files: hide language and symbol count')
        .option('--test-filter <glob>', 'affected: glob that marks test files (e.g. "e2e/*.spec.ts")')
        .option('--no-sync', 'Read the existing index without a freshness check')
        .option('-j, --json', 'Output JSON')
        .action(async (texts, options) => {
        const projectPath = resolveProjectPath(options.path);
        let graph;
        try {
            if (!isInitialized(projectPath)) {
                cli.error(`CodeGraph not initialized in ${projectPath}`);
                process.exitCode = 1;
                return;
            }
            const items = readItems(texts, options);
            const { CodeGraph } = require('../index');
            graph = await CodeGraph.open(projectPath);
            const { freshness, syncWarnings } = await syncBatch(cli, graph, projectPath, items, options);
            const context = { graph, cli, options, freshness, syncWarnings, semanticState: semanticStateOnce(graph) };
            const { answers, warnings } = await answerItems(context, items);
            if (!options.json) {
                printAnswers(cli, answers, warnings);
                return;
            }
            const results = answers.map(answer => ({ ...answer.base, ...(answer.error ? { error: answer.error } : answer.fields) }));
            console.log(JSON.stringify({ schemaVersion: 2, projectPath, freshness, warnings, results }, null, 2));
        }
        catch (caught) {
            cli.error(`Query failed: ${messageOf(caught)}`);
            process.exitCode = 1;
        }
        finally {
            graph?.close();
        }
    });
}

module.exports = { addQuery };
