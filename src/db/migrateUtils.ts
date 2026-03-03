export interface ForeignKeyEdge {
  child: string;
  parent: string;
}

export interface DeleteOrderResult {
  order: string[];
  cycleTables: string[];
}

export interface CreateTableDefinitions {
  columns: Record<string, string>;
  indexes: Record<string, string>;
  foreignKeys: Record<string, string>;
}

export interface DefinitionDiff {
  missing: string[];
  extra: string[];
  changed: string[];
}

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

export function computeDeleteOrder(
  tables: string[],
  foreignKeys: ForeignKeyEdge[],
): DeleteOrderResult {
  const tableSet = new Set(tables);
  const adjacency = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const table of tableSet) {
    adjacency.set(table, new Set<string>());
    inDegree.set(table, 0);
  }

  const dedupedEdges = new Set<string>();
  for (const edge of foreignKeys) {
    if (!tableSet.has(edge.child) || !tableSet.has(edge.parent)) {
      continue;
    }
    const key = `${edge.child}->${edge.parent}`;
    if (dedupedEdges.has(key)) {
      continue;
    }
    dedupedEdges.add(key);
    adjacency.get(edge.child)?.add(edge.parent);
    inDegree.set(edge.parent, (inDegree.get(edge.parent) ?? 0) + 1);
  }

  const queue = Array.from(tableSet).filter((table) => (inDegree.get(table) ?? 0) === 0);
  queue.sort();

  const ordered: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    ordered.push(current);

    const neighbors = Array.from(adjacency.get(current) ?? []);
    neighbors.sort();
    for (const neighbor of neighbors) {
      const nextDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, nextDegree);
      if (nextDegree === 0) {
        queue.push(neighbor);
        queue.sort();
      }
    }
  }

  if (ordered.length === tableSet.size) {
    return { order: ordered, cycleTables: [] };
  }

  const cycleTables = Array.from(tableSet)
    .filter((table) => (inDegree.get(table) ?? 0) > 0)
    .sort();

  return { order: ordered, cycleTables };
}

export function normalizeDefinition(definition: string): string {
  return definition
    .trim()
    .replace(/[`"]/g, "`")
    .replace(/\bCHARACTER SET\s+[a-zA-Z0-9_]+\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",");
}

export function diffNamedDefinitions(
  expected: Record<string, string>,
  actual: Record<string, string>,
): DefinitionDiff {
  const expectedKeys = new Set(Object.keys(expected));
  const actualKeys = new Set(Object.keys(actual));

  const missing = Array.from(expectedKeys).filter((key) => !actualKeys.has(key));
  const extra = Array.from(actualKeys).filter((key) => !expectedKeys.has(key));
  const changed = Array.from(expectedKeys).filter((key) => {
    if (!actualKeys.has(key)) {
      return false;
    }
    return normalizeDefinition(expected[key]) !== normalizeDefinition(actual[key]);
  });

  missing.sort();
  extra.sort();
  changed.sort();

  return { missing, extra, changed };
}

export function parseCreateTableSql(createTableSql: string): CreateTableDefinitions {
  const definitions: CreateTableDefinitions = {
    columns: {},
    indexes: {},
    foreignKeys: {},
  };

  const lines = createTableSql.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith("CREATE TABLE") || rawLine.startsWith(")")) {
      continue;
    }

    const line = rawLine.endsWith(",") ? rawLine.slice(0, -1) : rawLine;

    if (line.startsWith("`") || line.startsWith("\"")) {
      const match = line.match(/^([`"])([^`"]+)\1\s+/);
      if (match) {
        definitions.columns[match[2]] = line;
      }
      continue;
    }

    if (/^PRIMARY KEY\s+/i.test(line)) {
      definitions.indexes.PRIMARY = line;
      continue;
    }

    if (/^(?:UNIQUE\s+|FULLTEXT\s+|SPATIAL\s+)?KEY\s+/i.test(line)) {
      const match = line.match(/KEY\s+([`"])([^`"]+)\1/i);
      if (match) {
        definitions.indexes[match[2]] = line;
      }
      continue;
    }

    if (/^CONSTRAINT\s+[`"][^`"]+[`"]\s+FOREIGN KEY\s+/i.test(line)) {
      const match = line.match(/^CONSTRAINT\s+([`"])([^`"]+)\1/i);
      if (match) {
        definitions.foreignKeys[match[2]] = line;
      }
    }
  }

  return definitions;
}
