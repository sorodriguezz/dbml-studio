/**
 * DBML error suggestions — maps parse errors to actionable fix hints.
 */

export interface ErrorSuggestion {
  error: string;
  suggestions: string[];
  example?: string;
}

const PATTERNS: Array<{
  match: RegExp;
  suggestions: (m: RegExpMatchArray) => string[];
  example?: string;
}> = [
  {
    match: /no tables found/i,
    suggestions: () => [
      'Define at least one table with: Table name { ... }',
      'Make sure the keyword "Table" starts with a capital (or lowercase) T',
    ],
    example: 'Table users {\n  id integer [pk]\n}',
  },
  {
    match: /unexpected token|syntax error|parse error/i,
    suggestions: () => [
      'Check that every { has a matching }',
      'Field options must use square brackets: field type [pk, not null]',
      'Strings in defaults must be quoted: [default: \'value\']',
      'Remove any trailing commas after the last field',
    ],
  },
  {
    match: /unknown type|invalid type/i,
    suggestions: () => [
      'Use standard SQL types: integer, varchar(n), text, boolean, timestamp, uuid',
      'Arrays should be written as: integer[] not int[]',
    ],
    example: 'name varchar(100) [not null]',
  },
  {
    match: /duplicate (table|column|field)/i,
    suggestions: (m) => [
      `Rename one of the duplicate ${m[1]}s`,
      'Each table name must be unique within the schema',
      'Each field name must be unique within its table',
    ],
  },
  {
    match: /ref.*not found|unknown table|unknown column/i,
    suggestions: () => [
      'Make sure the referenced table and column are defined before the Ref',
      'Check for typos in table or column names — they are case-sensitive',
      'Ref format: Ref: table1.field > table2.field',
    ],
    example: 'Ref: orders.user_id > users.id',
  },
  {
    match: /missing.*primary key|no.*pk/i,
    suggestions: () => [
      'Add [pk] or [pk, increment] to one field',
      'UUID primary keys: id uuid [pk, default: `gen_random_uuid()`]',
    ],
    example: 'id integer [pk, increment]',
  },
  {
    match: /invalid.*default|default.*invalid/i,
    suggestions: () => [
      "String defaults need quotes: [default: 'value']",
      'Boolean defaults: [default: true] or [default: false]',
      'Function defaults use backticks: [default: `now()`]',
    ],
  },
  {
    match: /enum.*not found|unknown enum/i,
    suggestions: () => [
      'Define the enum before referencing it in a table field',
      'Enum names are case-sensitive',
    ],
    example: "Enum status {\n  active\n  inactive\n}\n\nTable users {\n  status status [not null]\n}",
  },
];

/**
 * Given a list of raw parse error strings, returns suggestions for each.
 */
export function getSuggestions(errors: string[]): ErrorSuggestion[] {
  return errors.map(error => {
    for (const pattern of PATTERNS) {
      const m = error.match(pattern.match);
      if (m) {
        return {
          error,
          suggestions: pattern.suggestions(m),
          example: pattern.example,
        };
      }
    }
    // Generic fallback
    return {
      error,
      suggestions: [
        'Check the DBML Reference (top-right button) for correct syntax',
        'Make sure Table/Enum/Ref blocks are properly closed with }',
        'Field format: name type [options]',
      ],
    };
  });
}
