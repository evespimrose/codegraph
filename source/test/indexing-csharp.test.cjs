const test = require('node:test');
const assert = require('node:assert/strict');
const { initGrammars, loadGrammarsForLanguages, MODERN_CSHARP_GRAMMAR } = require('../lib/extraction/grammars');
const { extractFromSource, TreeSitterExtractor } = require('../lib/extraction/tree-sitter');

test.before(async () => {
    await initGrammars();
    await loadGrammarsForLanguages(['csharp']);
});

const functionPointer = 'unsafe class Native { public void Invoke() { delegate* unmanaged[Cdecl]<void*, void> action; } }';
const conditionalMethods = `class EditorHooks {
#if LEGACY_EDITOR
    static void Changed()
#else
    static void Changed(int state)
#endif
    { Notify(); }
    static void Notify() {}
}`;

test('legal void pointer function-pointer parameter parses without recovered errors', () => {
    const result = extractFromSource('Native.cs', functionPointer, 'csharp');
    assert.deepEqual(result.errors, []);
    assert.equal(result.nodes.some(node => node.kind === 'method' && node.name === 'Invoke'), true);
});

test('void pointer fields properties returns and locals preserve declarations and source spans', () => {
    const source = `unsafe class Native {
    public void* Data;
    public void* Pointer => Data;
    public void* Allocate() { void* value = Data; return value; }
    public void Update() { uint required = 1; required = 2; }
}`;
    const result = extractFromSource('Native.cs', source, 'csharp');
    assert.deepEqual(result.errors, []);
    for (const name of ['Data', 'Pointer', 'Allocate', 'Update']) assert.ok(result.nodes.some(node => node.name === name), name);
    assert.match(source.split('\n')[result.nodes.find(node => node.name === 'Allocate').startLine - 1], /void\* Allocate/);
    const malformed = extractFromSource('Broken.cs', 'unsafe class Broken { void* value = ; }', 'csharp');
    assert.ok(malformed.errors.some(error => error.severity === 'error'));
});

test('bundled grammar parses parameter modifier pairs and async as a variable name', () => {
    const source = `static class Extensions {
    public static ref readonly T Get(this in Frame frame) => ref frame.Value;
    public static void Append(this ref Hash hash, int value) { }
    public static bool Remove(ref this Loop loop, Type type) => true;
    static void Read(scoped ref int x, ref readonly int y) { }
    static void Save(bool async) { if (async) Task.Run(Save); else Save(!async); }
    static void Run() { Items.Select(async _ => await Load()); Go(async (a, b) => await a); Go(async x => await x); }
}`;
    const result = new TreeSitterExtractor('Extensions.cs', source, 'csharp').extract();
    assert.deepEqual(result.errors, []);
    for (const name of ['Get', 'Append', 'Remove', 'Read', 'Save', 'Run']) assert.ok(result.nodes.some(node => node.kind === 'method' && node.name === name), name);
});

test('C# 11 and 12 syntax that the bundled grammar rejects is extracted through the upstream grammar', () => {
    const source = `namespace Shop;
public class Repository(IStore store) : IRepository
{
    private readonly int[] _ids = [1, 2, ..Defaults];
    public string Query => """
        SELECT * FROM "items"
        """;
    public Item Find(int id) => store.Read(id);
}
public interface IRepository;`;
    const primary = new TreeSitterExtractor('Repository.cs', source, 'csharp').extract();
    assert.ok(primary.errors.some(error => error.severity === 'error'), 'fixture must exercise the fallback');
    const result = extractFromSource('Repository.cs', source, 'csharp');
    assert.deepEqual(result.errors, []);
    for (const name of ['Repository', '_ids', 'Query', 'Find', 'IRepository']) assert.ok(result.nodes.some(node => node.name === name), name);
    assert.ok(result.unresolvedReferences.some(reference => reference.referenceKind === 'calls' && reference.referenceName === 'store.Read' && reference.line === 8));
    assert.ok(result.unresolvedReferences.some(reference => reference.referenceKind === 'references' && reference.referenceName === 'Item' && reference.line === 8));
    const broken = extractFromSource('Repository.cs', source.replace('store.Read(id);', 'store.Read(id;'), 'csharp');
    assert.ok(broken.errors.some(error => error.severity === 'error'));
});

test('each conditional variant uses whichever grammar parses it', () => {
    const source = `unsafe class Mixed {
    void Run(int* p) {
#if NEW
        var text = """raw""";
#else
        *(int*)p = Read();
#endif
    }
}`;
    const result = extractFromSource('Mixed.cs', source, 'csharp');
    assert.equal(result.errors.some(error => error.severity === 'error'), false, JSON.stringify(result.errors));
    assert.equal(result.nodes.filter(node => node.kind === 'method' && node.name === 'Run').length, 1);
    assert.ok(result.unresolvedReferences.some(reference => reference.referenceName === 'Read' && reference.line === 6));
});

test('upstream grammar extraction matches the bundled grammar for aliases, dereferenced calls, and return types', () => {
    const source = `using Scene = Trigger;
unsafe class Store {
    Item Load(int slot) { var first = *Container.GetFirst(slot); return first; }
}`;
    const names = grammar => {
        const result = new TreeSitterExtractor('Store.cs', source, 'csharp', grammar).extract();
        assert.deepEqual(result.errors, [], grammar);
        return result.unresolvedReferences.map(reference => `${reference.referenceKind}:${reference.referenceName}:${reference.line}`).sort();
    };
    const bundled = names('csharp');
    assert.deepEqual(names(MODERN_CSHARP_GRAMMAR), bundled);
    for (const expected of ['imports:Trigger:1', 'calls:Container.GetFirst:3', 'references:Item:3']) assert.ok(bundled.includes(expected), expected);
});

test('unrepresented parser recovery still produces an explicit error', () => {
    const { collectCSharpDiagnostics } = require('../lib/extraction/csharp-diagnostics');
    const diagnostics = collectCSharpDiagnostics({ type: 'compilation_unit', hasError: true, childCount: 0, startPosition: { row: 0, column: 0 } }, '', 'Broken.cs');
    assert.equal(diagnostics[0].severity, 'error');
});

test('valid conditional signatures sharing a body are retained with a grammar warning', () => {
    const result = extractFromSource('EditorHooks.cs', conditionalMethods, 'csharp');
    assert.equal(result.errors.length, 1, JSON.stringify(result.errors));
    assert.equal(result.errors[0].code, 'grammar_limitation');
    assert.equal(result.errors[0].severity, 'warning');
    assert.equal(result.nodes.filter(node => node.kind === 'method' && node.name === 'Changed').length, 2);
    assert.equal(result.nodes.some(node => node.kind === 'method' && node.name === 'Notify'), true);
});

test('known grammar limitations never hide unrelated malformed C# in the same file', () => {
    for (const valid of [functionPointer, conditionalMethods]) {
        const result = extractFromSource('Mixed.cs', `${valid}\nclass Broken { void Run(`, 'csharp');
        assert.equal(result.errors.some(error => error.severity === 'error' && error.code === 'syntax_error'), true);
    }
});

test('malformed conditional signatures and incomplete function pointers remain errors', () => {
    const malformed = [
        conditionalMethods.replace('Changed(int state)', 'Changed(int state'),
        conditionalMethods.replace('{ Notify(); }', '{ Notify( }'),
        functionPointer.replace('<void*, void>', '<void* void>'),
        'class Broken { static void Changed()\n#else\nstatic void Changed(int state)\n#endif\n{} }',
    ];
    for (const source of malformed) {
        const result = extractFromSource('Broken.cs', source, 'csharp');
        assert.equal(result.errors.some(error => error.severity === 'error'), true, source);
    }
});
