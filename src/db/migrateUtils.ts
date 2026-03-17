/**
 * Splits raw SQL into executable statements while ignoring semicolons inside
 * quoted strings/identifiers and removing SQL comments.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let buffer = "";

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : "";
    const next2 = i + 2 < sql.length ? sql[i + 2] : "";
    const prev = i > 0 ? sql[i - 1] : "";

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        buffer += ch;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
      const lineCommentStart =
        ch === "-" &&
        next === "-" &&
        (next2 === " " ||
          next2 === "\t" ||
          next2 === "\r" ||
          next2 === "\n" ||
          next2 === "") &&
        (i === 0 || prev === "\n" || prev === "\r" || prev === "\t" || prev === " ");
      if (lineCommentStart) {
        inLineComment = true;
        i += 1;
        continue;
      }

      if (ch === "/" && next === "*") {
        inBlockComment = true;
        i += 1;
        continue;
      }
    }

    if (inSingleQuote) {
      buffer += ch;
      if (ch === "'" && next === "'") {
        buffer += next;
        i += 1;
        continue;
      }
      if (ch === "\\") {
        if (next) {
          buffer += next;
          i += 1;
        }
        continue;
      }
      if (ch === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      buffer += ch;
      if (ch === "\"" && next === "\"") {
        buffer += next;
        i += 1;
        continue;
      }
      if (ch === "\\") {
        if (next) {
          buffer += next;
          i += 1;
        }
        continue;
      }
      if (ch === "\"") {
        inDoubleQuote = false;
      }
      continue;
    }

    if (inBacktick) {
      buffer += ch;
      if (ch === "`" && next === "`") {
        buffer += next;
        i += 1;
        continue;
      }
      if (ch === "`") {
        inBacktick = false;
      }
      continue;
    }

    if (ch === "'") {
      inSingleQuote = true;
      buffer += ch;
      continue;
    }
    if (ch === "\"") {
      inDoubleQuote = true;
      buffer += ch;
      continue;
    }
    if (ch === "`") {
      inBacktick = true;
      buffer += ch;
      continue;
    }

    if (ch === ";") {
      const statement = buffer.trim();
      if (statement) {
        statements.push(statement);
      }
      buffer = "";
      continue;
    }

    buffer += ch;
  }

  const trailing = buffer.trim();
  if (trailing) {
    statements.push(trailing);
  }

  return statements;
}
