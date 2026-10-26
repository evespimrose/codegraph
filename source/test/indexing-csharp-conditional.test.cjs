const test = require('node:test');
const assert = require('node:assert/strict');
const { initGrammars, loadGrammarsForLanguages } = require('../lib/extraction/grammars');
const { extractFromSource } = require('../lib/extraction/tree-sitter');
const { getConditionalVariants } = require('../lib/extraction/csharp-branches');

test.before(async () => {
    await initGrammars();
    await loadGrammarsForLanguages(['csharp']);
});

test('conditional arrow bodies include calls from every explicit alternative with stable IDs', () => {
    const source = `class Writer {
    public static void Write(string text)
#if UNITY
        => UnitySink.Log(text);
#elif CONSOLE
        => ConsoleSink.Print(text);
#endif
}`;
    const result = extractFromSource('Writer.cs', source, 'csharp');
    assert.equal(result.errors.some(error => error.severity === 'error'), false, JSON.stringify(result.errors));
    assert.ok(result.errors.some(error => error.code === 'conditional_branches'));
    assert.equal(result.nodes.filter(node => node.name === 'Write').length, 1);
    assert.equal(result.nodes.length, new Set(result.nodes.map(node => node.id)).size);
    assert.ok(result.unresolvedReferences.some(reference => reference.referenceName.includes('Log') && reference.line === 4));
    assert.ok(result.unresolvedReferences.some(reference => reference.referenceName.includes('Print') && reference.line === 6));
    const broken = extractFromSource('Writer.cs', source.replace('ConsoleSink.Print(text)', 'ConsoleSink.Print('), 'csharp');
    assert.ok(broken.errors.some(error => error.severity === 'error'));
});

test('conditional expression alternatives retain calls and original line spans', () => {
    const source = `class Selection {
    void Read() { var value =
#if NEW_API
        controller.ReadNew()
#else
        controller?.ReadOld()
#endif
        ; Always(); }
}`;
    const result = extractFromSource('Selection.cs', source, 'csharp');
    assert.equal(result.errors.some(error => error.severity === 'error'), false, JSON.stringify(result.errors));
    assert.ok(result.unresolvedReferences.some(reference => reference.referenceName.includes('ReadNew') && reference.line === 4));
    assert.ok(result.unresolvedReferences.some(reference => reference.referenceName.includes('ReadOld') && reference.line === 6));
    assert.equal(result.unresolvedReferences.filter(reference => reference.referenceName.includes('Always')).length, 1);
});

test('nested branches are reachable and malformed nested alternatives never become healthy', () => {
    const source = `class Nested { void Run() {
#if OUTER
    Alpha();
#else
#if INNER
    Beta();
#else
    Gamma();
#endif
#endif
} }`;
    const plan = getConditionalVariants(source);
    assert.equal(plan.error, undefined);
    for (const call of ['Alpha()', 'Beta()', 'Gamma()']) assert.ok(plan.variants.some(variant => variant.includes(call)), call);
    for (const variant of plan.variants) {
        assert.equal(variant.length, source.length);
        assert.equal(variant.split('\n').length, source.split('\n').length);
    }
    const broken = extractFromSource('Nested.cs', source.replace('Gamma();', 'Gamma(;'), 'csharp');
    assert.ok(broken.errors.some(error => error.severity === 'error'));
});

test('conditional planning ignores directive text inside strings and fails explicitly above its bound', () => {
    const literal = 'class Literal { string text = @"\n#if FAKE\n#else\n#endif\n"; }';
    assert.deepEqual(getConditionalVariants(literal).variants, []);
    const chain = Array.from({ length: 65 }, (_, index) => `#${index ? 'elif' : 'if'} FLAG_${index}\nvoid Only${index}() {}`).join('\n');
    const plan = getConditionalVariants(`class Many {\n${chain}\n#endif\n}`);
    assert.match(plan.error, /64-variant limit/);
    assert.deepEqual(plan.variants, []);
});

test('conditional variants share consistent symbol sets and skip branches that never compile', () => {
    const sections = Array.from({ length: 65 }, (_, index) => `#if FLAG_${index}\nvoid First${index}() {}\n#else\nvoid Second${index}() {}\n#endif`).join('\n');
    const independent = getConditionalVariants(`class Many {\n${sections}\n}`);
    assert.equal(independent.variants.length, 2);
    for (let index = 0; index < 65; index++) {
        for (const name of [`First${index}()`, `Second${index}()`]) assert.ok(independent.variants.some(variant => variant.includes(name)), name);
    }
    const dead = getConditionalVariants('class Dead {\n#if A && !A\nvoid Never() {}\n#endif\n#if B\nvoid Sometimes() {}\n#endif\n}');
    assert.deepEqual(dead.variants.map(variant => [variant.includes('Never'), variant.includes('Sometimes')]), [[false, true]]);
});

test('conditional planning reads directives from text where parser recovery swallows them', () => {
    const source = `class Gui {
  const string TypeName =
#if NEW
    "A";
#else
    "B";
#endif
  static readonly int Value =
#if NEW
    1;
#else
    2;
#endif
}`;
    const plan = getConditionalVariants(source);
    assert.equal(plan.error, undefined);
    assert.equal(plan.variants.length, 2);
    for (const variant of plan.variants) assert.doesNotMatch(variant, /#/);
    const result = extractFromSource('Gui.cs', source, 'csharp');
    assert.equal(result.errors.some(error => error.severity === 'error'), false, JSON.stringify(result.errors));
});

test('directive-like lines inside comments and multi-line strings stay text', () => {
    const source = [
        'class Template {',
        '  /*',
        '#if COMMENT',
        '  */',
        '  string Raw = """',
        '#if RAW',
        '    """;',
        '  string Verbatim = $@"{Name}',
        '#if VERBATIM',
        '";',
        "  char Quote = '\"';",
        '#if REAL',
        '  int Real;',
        '#endif',
        '}',
    ].join('\n');
    const plan = getConditionalVariants(source);
    assert.equal(plan.error, undefined);
    assert.equal(plan.variants.length, 1);
    for (const kept of ['#if COMMENT', '#if RAW', '#if VERBATIM']) assert.ok(plan.variants[0].includes(kept), kept);
    assert.ok(!plan.variants[0].includes('#if REAL'));
    assert.ok(plan.variants[0].includes('int Real;'));
});

test('complementary conditional blocks never combine into one variant', () => {
    const source = `namespace Game {
  public class Prototype
#if MIGRATION
    : global::LegacyPrototype { }
} // namespace Game
  public abstract class LegacyPrototype
#endif
    : Behaviour {
#if EDITOR
    void Validate() { Check(); }
#endif
  }
#if !MIGRATION
}
#endif`;
    const result = extractFromSource('Prototype.cs', source, 'csharp');
    assert.equal(result.errors.some(error => error.severity === 'error'), false, JSON.stringify(result.errors));
    for (const name of ['Prototype', 'LegacyPrototype', 'Validate']) assert.ok(result.nodes.some(node => node.name === name), name);
    assert.ok(result.unresolvedReferences.some(reference => reference.referenceName === 'Check' && reference.line === 10));
});

test('a declaration with a conditional leading attribute stays one symbol across variants', () => {
    const source = `class Logger {
#if NEW_API
    [HideInCallstack]
#endif
    [DebuggerHidden]
    public static void Log(string message)
#if NEW_API
        => Debug.Log(message);
#elif CONSOLE
        => Console.WriteLine(message);
#endif
}`;
    const result = extractFromSource('Logger.cs', source, 'csharp');
    assert.equal(result.errors.some(error => error.severity === 'error'), false, JSON.stringify(result.errors));
    const methods = result.nodes.filter(node => node.name === 'Log');
    assert.equal(methods.length, 1);
    assert.deepEqual([methods[0].startLine, methods[0].endLine], [3, 10]);
    assert.deepEqual(result.nodes.filter(node => node.kind === 'metadata').map(node => node.name).sort(), ['DebuggerHidden', 'HideInCallstack']);
    for (const [name, line] of [['Debug.Log', 8], ['Console.WriteLine', 10]]) {
        assert.ok(result.unresolvedReferences.some(reference => reference.referenceName === name && reference.line === line && reference.fromNodeId === methods[0].id), name);
    }
    const ids = new Set(result.nodes.map(node => node.id));
    assert.ok(result.edges.every(edge => ids.has(edge.source) && ids.has(edge.target)), JSON.stringify(result.edges));
});

test('an attribute shared by different conditional declarations stays attached to each', () => {
    const source = `class Allocator {
    [BurstCompile]
#if UNITY
    public static int AlignOf() => 1;
#else
    private struct Helper { }
#endif
    public static int SizeOf()
#if UNITY
        => Unity.Size();
#else
        => Net.Size();
#endif
}`;
    const result = extractFromSource('Allocator.cs', source, 'csharp');
    assert.equal(result.errors.some(error => error.severity === 'error'), false, JSON.stringify(result.errors));
    const applications = result.nodes.filter(node => node.kind === 'metadata' && node.name === 'BurstCompile');
    assert.deepEqual(applications.map(node => node.qualifiedName.split('::metadata:')[0]).sort(), ['Allocator::AlignOf', 'Allocator::Helper']);
});

test('invalid conditional directive ordering and conditions are rejected during recovery', () => {
    for (const directives of ['#if A\n#else\n#else\n#endif', '#if A\n#else\n#elif B\n#endif', '#if !\n#endif']) {
        const source = `class Invalid {\n${directives}\n}`;
        assert.ok(getConditionalVariants(source).error, source);
    }
});

test('recovery rejects trailing directive garbage while preserving legal comments', () => {
    const template = 'class Writer { void Write()\n#if A\n=> First();\n#else\n=> Second();\n#endif\n}';
    for (const [before, after] of [['#if A', '#if A B'], ['#else', '#else junk'], ['#endif', '#endif junk']]) {
        const result = extractFromSource('Invalid.cs', template.replace(before, after), 'csharp');
        assert.ok(result.errors.some(error => error.severity === 'error'), after);
    }
    const withComments = template.replace('#if A', '#if A // chosen branch').replace('#else', '#else /* alternate */').replace('#endif', '#endif // completed');
    const result = extractFromSource('Writer.cs', withComments, 'csharp');
    assert.equal(result.errors.some(error => error.severity === 'error'), false, JSON.stringify(result.errors));
    assert.ok(result.unresolvedReferences.some(reference => reference.referenceName.includes('First')));
    assert.ok(result.unresolvedReferences.some(reference => reference.referenceName.includes('Second')));
});
