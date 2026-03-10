import { StreamLanguage } from "@codemirror/language";
import { sql } from "@codemirror/lang-sql";

interface DBMLState {
  inComment: boolean;
  inString: string | null;
}

// Custom DBML keywords and syntax highlighting
export const dbmlLanguage = StreamLanguage.define<DBMLState>({
  token(stream, state) {
    // Comments
    if (stream.match(/\/\/.*/)) {
      return "comment";
    }
    if (stream.match(/\/\*/)) {
      state.inComment = true;
      return "comment";
    }
    if (state.inComment) {
      if (stream.match(/\*\//)) {
        state.inComment = false;
      } else {
        stream.next();
      }
      return "comment";
    }

    // Strings
    if (!state.inString && stream.match(/['"`]/)) {
      const quote = stream.current();
      state.inString = quote;
      return "string";
    }
    if (state.inString) {
      if (stream.match(new RegExp(state.inString))) {
        state.inString = null;
      } else {
        stream.next();
      }
      return "string";
    }

    // Keywords - DBML specific
    if (stream.match(/\b(Table|Ref|Enum|TableGroup|Project|Indexes|Note|as)\b/i)) {
      return "keyword";
    }

    // Types
    if (stream.match(/\b(integer|int|bigint|smallint|varchar|text|boolean|bool|timestamp|datetime|date|time|decimal|numeric|float|double|json|jsonb|uuid|serial|bigserial)\b/i)) {
      return "typeName";
    }

    // Modifiers/attributes
    if (stream.match(/\b(pk|primary key|null|not null|unique|default|increment|ref|note|indexes)\b/i)) {
      return "attributeName";
    }

    // Relationship types
    if (stream.match(/[<>-]+/)) {
      return "operator";
    }

    // Brackets
    if (stream.match(/[{}\[\]()]/)) {
      return "bracket";
    }

    // Numbers
    if (stream.match(/\b\d+\.?\d*\b/)) {
      return "number";
    }

    // Dots for table.field references
    if (stream.match(/\./)) {
      return "punctuation";
    }

    // Identifiers (table names, field names)
    if (stream.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/)) {
      return "variableName";
    }

    stream.next();
    return null;
  },
  startState() {
    return { inComment: false, inString: null };
  },
  copyState(state) {
    return { ...state };
  }
});
