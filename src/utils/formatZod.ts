import type { ZodIssue } from "zod";

export function formatZodIssues(issues: ZodIssue[]): string[] {
  return issues.map((i) => {
    const path =
      Array.isArray(i.path) && i.path.length > 0 ? i.path.join(".") : "<root>";
    return `${path}: ${i.message}`;
  });
}

export default formatZodIssues;
