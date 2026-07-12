/**
 * ADR-052 §F — deterministic zod schema source generation from a JSON
 * example (request/response bodies the source document itself provided).
 * Never invents a shape beyond what the example shows; an endpoint with
 * no example gets z.unknown(), never a guessed structure.
 */

function inferZodExpression(value: unknown, indent: number): string {
  const pad = "  ".repeat(indent);
  const childPad = "  ".repeat(indent + 1);

  if (value === null) return "z.null()";
  if (Array.isArray(value)) {
    if (value.length === 0) return "z.array(z.unknown())";
    return `z.array(${inferZodExpression(value[0], indent)})`;
  }
  if (typeof value === "string") return "z.string()";
  if (typeof value === "number") return "z.number()";
  if (typeof value === "boolean") return "z.boolean()";
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "z.record(z.unknown())";
    const fields = entries
      .map(
        ([key, val]) =>
          `${childPad}${JSON.stringify(key)}: ${inferZodExpression(val, indent + 1)},`
      )
      .join("\n");
    return `z.object({\n${fields}\n${pad}})`;
  }
  return "z.unknown()";
}

/**
 * Returns a standalone `export const <name> = z...;` statement, or null
 * when the source document gave no example to infer from — the caller
 * decides what a missing schema means (usually z.unknown() inline).
 */
export function generateZodSchemaSource(
  exportName: string,
  example: unknown | null
): string | null {
  if (example === null || example === undefined) return null;
  return `export const ${exportName} = ${inferZodExpression(example, 0)};`;
}
