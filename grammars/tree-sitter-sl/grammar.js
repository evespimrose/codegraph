/**
 * tree-sitter grammar for SL — FEGate FFS Script Language.
 *
 * SL is C-like (same operators, control flow, structs, comments) with these
 * differences (FFS_API_Technical_Specifications.md / fegate-sl-grammar.md):
 *   - NO pointers, casting, or `->`. Call-by-reference uses `ref`.
 *   - Added keywords: bool string set map vec3 ref foreach_db
 *   - Unsupported: goto typedef const unsigned auto register static extern sizeof union
 *   - Containers: array(1D) matrix(2D) set map ; value types vec3/string/bool
 *   - `::` namespace member access (dbNode::First()) — like C++ qualified ids
 *   - Supports `namespace` blocks and forward (prototype) declarations
 *   - Preprocessor: only #include
 *
 * Node names are kept compatible with tree-sitter-c (function_definition,
 * struct_specifier, enum_specifier, call_expression, preproc_include,
 * declaration, qualified_identifier) so CodeGraph's slExtractor mirrors the
 * existing cppExtractor (incl. its :: qualified-name/receiver helpers).
 */

const PREC = {
  ASSIGN: 1,
  TERNARY: 2,
  LOGICAL_OR: 3,
  LOGICAL_AND: 4,
  BIT_OR: 5,
  BIT_XOR: 6,
  BIT_AND: 7,
  EQUALITY: 8,
  RELATIONAL: 9,
  SHIFT: 10,
  ADD: 11,
  MULTIPLY: 12,
  UNARY: 13,
  POSTFIX: 14,
};

function commaSep(rule) {
  return optional(commaSep1(rule));
}
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

module.exports = grammar({
  name: 'sl',

  word: $ => $.identifier,

  extras: $ => [/\s+/, $.comment],

  rules: {
    source_file: $ => repeat($._top_level),

    _top_level: $ => choice(
      $.preproc_include,
      $.namespace_definition,
      $.function_definition,
      $.struct_declaration,
      $.enum_declaration,
      $.declaration,
    ),

    // ---------- preprocessor (only #include) ----------
    preproc_include: $ => seq(
      '#include',
      field('path', choice($.system_lib_string, $.string_literal)),
    ),
    system_lib_string: _ => token(seq('<', /[^>\n]*/, '>')),

    // ---------- namespace ----------
    namespace_definition: $ => seq(
      'namespace',
      field('name', $.identifier),
      field('body', $.declaration_list),
    ),
    declaration_list: $ => seq('{', repeat($._top_level), '}'),

    // ---------- types ----------
    _type: $ => choice($.primitive_type, $._type_identifier),
    primitive_type: _ => choice(
      'void', 'int', 'int64', 'double', 'bool', 'string', 'vec3', 'char',
      'array', 'matrix', 'set', 'map',
    ),
    _type_identifier: $ => alias($.identifier, $.type_identifier),

    // ---------- function definition ----------
    function_definition: $ => seq(
      field('type', $._type),
      field('declarator', $.function_declarator),
      field('body', $.compound_statement),
    ),
    function_declarator: $ => seq(
      field('declarator', choice($.identifier, $.qualified_identifier)),
      field('parameters', $.parameter_list),
    ),
    parameter_list: $ => seq('(', commaSep($.parameter_declaration), ')'),
    parameter_declaration: $ => seq(
      optional('ref'),
      field('type', $._type),
      optional(field('declarator', $._declarator)),
    ),

    _declarator: $ => choice($.identifier, $.array_declarator),
    array_declarator: $ => prec(1, seq(
      field('declarator', choice($.identifier, $.array_declarator)),
      '[', optional($._expression), ']',
    )),

    qualified_identifier: $ => seq(
      $.identifier, '::', choice($.identifier, $.qualified_identifier),
    ),

    // ---------- struct ----------
    struct_declaration: $ => seq($.struct_specifier, ';'),
    struct_specifier: $ => seq(
      'struct',
      field('name', $.identifier),
      field('body', $.field_declaration_list),
    ),
    field_declaration_list: $ => seq('{', repeat($.field_declaration), '}'),
    field_declaration: $ => seq(
      field('type', $._type),
      commaSep1($._declarator),
      ';',
    ),

    // ---------- enum (anonymous allowed) ----------
    enum_declaration: $ => seq($.enum_specifier, ';'),
    enum_specifier: $ => seq(
      'enum',
      optional(field('name', $.identifier)),
      field('body', $.enumerator_list),
    ),
    enumerator_list: $ => seq('{', commaSep($.enumerator), optional(','), '}'),
    enumerator: $ => seq(field('name', $.identifier), optional(seq('=', $._expression))),

    // ---------- declaration (variables + prototypes) ----------
    declaration: $ => seq(
      field('type', $._type),
      commaSep1(choice($.init_declarator, $.function_declarator)),
      ';',
    ),
    init_declarator: $ => seq(
      field('declarator', $._declarator),
      optional(seq('=', field('value', choice($._expression, $.initializer_list)))),
    ),

    // ---------- statements ----------
    compound_statement: $ => seq('{', repeat($._statement), '}'),
    _statement: $ => choice(
      $.declaration,
      $.expression_statement,
      $.if_statement,
      $.for_statement,
      $.foreach_db_statement,
      $.while_statement,
      $.do_statement,
      $.switch_statement,
      $.return_statement,
      $.break_statement,
      $.continue_statement,
      $.compound_statement,
      $.empty_statement,
    ),
    empty_statement: _ => ';',
    expression_statement: $ => seq($._expression, ';'),
    if_statement: $ => prec.right(seq(
      'if', '(', field('condition', $._expression), ')',
      field('consequence', $._statement),
      optional(seq('else', field('alternative', $._statement))),
    )),
    for_statement: $ => seq(
      'for', '(',
      choice($.declaration, $.expression_statement, $.empty_statement),
      optional($._expression), ';',
      optional($._expression),
      ')',
      field('body', $._statement),
    ),
    foreach_db_statement: $ => seq(
      'foreach_db', '(',
      field('var', $.identifier), ',', field('db', $._expression),
      ')',
      field('body', $._statement),
    ),
    while_statement: $ => seq(
      'while', '(', field('condition', $._expression), ')',
      field('body', $._statement),
    ),
    do_statement: $ => seq(
      'do', field('body', $._statement),
      'while', '(', field('condition', $._expression), ')', ';',
    ),
    switch_statement: $ => seq(
      'switch', '(', field('condition', $._expression), ')',
      field('body', $.switch_body),
    ),
    switch_body: $ => seq('{', repeat(choice($.case_statement, $._statement)), '}'),
    case_statement: $ => prec.right(seq(
      choice(seq('case', $._expression), 'default'), ':',
      repeat($._statement),
    )),
    return_statement: $ => seq('return', optional($._expression), ';'),
    break_statement: _ => seq('break', ';'),
    continue_statement: _ => seq('continue', ';'),

    // ---------- expressions ----------
    _expression: $ => choice(
      $.identifier,
      $.qualified_identifier,
      $.number_literal,
      $.string_literal,
      $.concatenated_string,
      $.char_literal,
      $.boolean_literal,
      $.call_expression,
      $.subscript_expression,
      $.field_expression,
      $.binary_expression,
      $.unary_expression,
      $.update_expression,
      $.assignment_expression,
      $.conditional_expression,
      $.parenthesized_expression,
    ),
    parenthesized_expression: $ => seq('(', $._expression, ')'),
    call_expression: $ => prec(PREC.POSTFIX, seq(
      field('function', $._expression),
      field('arguments', $.argument_list),
    )),
    argument_list: $ => seq('(', commaSep($._expression), ')'),
    subscript_expression: $ => prec(PREC.POSTFIX, seq(
      field('argument', $._expression),
      '[', field('index', $._expression), ']',
    )),
    field_expression: $ => prec(PREC.POSTFIX, seq(
      field('argument', $._expression),
      '.', field('field', $.identifier),
    )),
    update_expression: $ => prec.left(PREC.POSTFIX, choice(
      seq(field('argument', $._expression), choice('++', '--')),
      seq(choice('++', '--'), field('argument', $._expression)),
    )),
    unary_expression: $ => prec.right(PREC.UNARY, seq(
      field('operator', choice('!', '~', '-', '+')),
      field('argument', $._expression),
    )),
    binary_expression: $ => {
      const table = [
        ['||', PREC.LOGICAL_OR],
        ['&&', PREC.LOGICAL_AND],
        ['|', PREC.BIT_OR],
        ['^', PREC.BIT_XOR],
        ['&', PREC.BIT_AND],
        ['==', PREC.EQUALITY], ['!=', PREC.EQUALITY],
        ['<', PREC.RELATIONAL], ['>', PREC.RELATIONAL],
        ['<=', PREC.RELATIONAL], ['>=', PREC.RELATIONAL],
        ['<<', PREC.SHIFT], ['>>', PREC.SHIFT],
        ['+', PREC.ADD], ['-', PREC.ADD],
        ['*', PREC.MULTIPLY], ['/', PREC.MULTIPLY], ['%', PREC.MULTIPLY],
      ];
      return choice(...table.map(([op, p]) => prec.left(p, seq(
        field('left', $._expression),
        field('operator', op),
        field('right', $._expression),
      ))));
    },
    assignment_expression: $ => prec.right(PREC.ASSIGN, seq(
      field('left', $._expression),
      field('operator', choice('=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=')),
      field('right', $._expression),
    )),
    conditional_expression: $ => prec.right(PREC.TERNARY, seq(
      field('condition', $._expression), '?',
      field('consequence', $._expression), ':',
      field('alternative', $._expression),
    )),
    initializer_list: $ => seq(
      '{', commaSep(choice($._expression, $.initializer_list)), optional(','), '}',
    ),

    // ---------- literals ----------
    number_literal: _ => token(choice(
      /\d+\.\d*([eE][+-]?\d+)?[fFlL]?/,
      /\.\d+([eE][+-]?\d+)?[fFlL]?/,
      /\d+([eE][+-]?\d+)?[fFlLuU]*/,
      /0[xX][0-9a-fA-F]+[uUlL]*/,
    )),
    concatenated_string: $ => prec.left(seq(
      $.string_literal, repeat1($.string_literal),
    )),
    string_literal: $ => seq(
      '"', repeat(choice(token.immediate(/[^"\\\n]+/), $.escape_sequence)), '"',
    ),
    char_literal: $ => seq(
      "'", choice(token.immediate(/[^'\\\n]/), $.escape_sequence), "'",
    ),
    escape_sequence: _ => token.immediate(/\\([\\'"?abfnrtv0]|x[0-9a-fA-F]+|[0-7]{1,3})/),
    boolean_literal: _ => choice('true', 'false'),

    identifier: _ => /[A-Za-z_]\w*/,

    comment: _ => token(choice(
      seq('//', /[^\n]*/),
      seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/'),
    )),
  },
});
