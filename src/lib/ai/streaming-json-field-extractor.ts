/**
 * Incrementally extracts one string field's value out of a JSON object as it
 * streams in token-by-token, before the object as a whole is valid/parseable.
 *
 * Used to reveal the guest-facing `message` field of the LLM's structured
 * JSON response as it's generated, without touching the response format or
 * the rest of the structured payload (proposedItems/intent/etc still wait
 * for the full JSON and go through the existing parse + guard pipeline
 * unchanged).
 */
export class StreamingJsonStringFieldExtractor {
  private readonly keyPattern: RegExp;
  private buffer = "";
  private phase: "seeking-key" | "in-value" | "done" = "seeking-key";

  constructor(fieldName: string) {
    this.keyPattern = new RegExp(`"${fieldName}"\\s*:\\s*"`);
  }

  get done(): boolean {
    return this.phase === "done";
  }

  /** Feed a new raw text chunk; returns any newly-revealed decoded text (may be ""). */
  push(chunk: string): string {
    if (this.phase === "done" || !chunk) return "";
    this.buffer += chunk;

    if (this.phase === "seeking-key") {
      const match = this.keyPattern.exec(this.buffer);
      if (!match) {
        // Keep only a small tail in case the key straddles a chunk boundary.
        const tailLength = 32;
        if (this.buffer.length > tailLength) {
          this.buffer = this.buffer.slice(-tailLength);
        }
        return "";
      }
      this.buffer = this.buffer.slice(match.index + match[0].length);
      this.phase = "in-value";
    }

    return this.consumeValue();
  }

  private consumeValue(): string {
    let emit = "";
    let i = 0;

    while (i < this.buffer.length) {
      const ch = this.buffer[i];

      if (ch === "\\") {
        const next = this.buffer[i + 1];
        if (next === undefined) break; // wait for more data

        if (next === "u") {
          const hex = this.buffer.slice(i + 2, i + 6);
          if (hex.length < 4) break; // wait for more data
          const code = Number.parseInt(hex, 16);
          emit += Number.isNaN(code) ? "" : String.fromCharCode(code);
          i += 6;
          continue;
        }

        emit += decodeSimpleEscape(next);
        i += 2;
        continue;
      }

      if (ch === '"') {
        this.phase = "done";
        i += 1;
        break;
      }

      emit += ch;
      i += 1;
    }

    this.buffer = this.buffer.slice(i);
    return emit;
  }
}

function decodeSimpleEscape(char: string): string {
  switch (char) {
    case '"':
      return '"';
    case "\\":
      return "\\";
    case "/":
      return "/";
    case "n":
      return "\n";
    case "t":
      return "\t";
    case "r":
      return "\r";
    case "b":
      return "\b";
    case "f":
      return "\f";
    default:
      return char;
  }
}
