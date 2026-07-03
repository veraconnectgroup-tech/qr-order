import { describe, expect, it } from "vitest";
import { StreamingJsonStringFieldExtractor } from "@/lib/ai/streaming-json-field-extractor";

function feedInOneShot(json: string, field = "message"): string {
  const extractor = new StreamingJsonStringFieldExtractor(field);
  return extractor.push(json);
}

function feedCharByChar(json: string, field = "message"): string {
  const extractor = new StreamingJsonStringFieldExtractor(field);
  let out = "";
  for (const ch of json) {
    out += extractor.push(ch);
  }
  return out;
}

function feedInChunks(json: string, chunkSize: number, field = "message"): string {
  const extractor = new StreamingJsonStringFieldExtractor(field);
  let out = "";
  for (let i = 0; i < json.length; i += chunkSize) {
    out += extractor.push(json.slice(i, i + chunkSize));
  }
  return out;
}

describe("StreamingJsonStringFieldExtractor", () => {
  it("extracts a plain message value in one shot", () => {
    const json = '{"message":"Dobro vece, izvolite?","intent":"chat"}';
    expect(feedInOneShot(json)).toBe("Dobro vece, izvolite?");
  });

  it("extracts correctly when fed character by character", () => {
    const json = '{"message":"jedno pivo, odmah stize","intent":"chat"}';
    expect(feedCharByChar(json)).toBe("jedno pivo, odmah stize");
  });

  it("extracts correctly across arbitrary chunk boundaries", () => {
    const json =
      '{"message":"Dobro vece - dobrodosli u Skyline Lounge!","proposedItems":[]}';
    for (const size of [1, 2, 3, 5, 7, 11, 17]) {
      expect(feedInChunks(json, size)).toBe(
        "Dobro vece - dobrodosli u Skyline Lounge!"
      );
    }
  });

  it("handles escaped quotes inside the value", () => {
    const json = '{"message":"Nasa \\"Skyline\\" ponuda","intent":"chat"}';
    expect(feedInOneShot(json)).toBe('Nasa "Skyline" ponuda');
    expect(feedCharByChar(json)).toBe('Nasa "Skyline" ponuda');
  });

  it("handles escaped backslash and control characters", () => {
    const json = '{"message":"red1\\nred2\\tkraj\\\\","intent":"chat"}';
    expect(feedInOneShot(json)).toBe("red1\nred2\tkraj\\");
  });

  it("handles unicode escapes, including split across chunks", () => {
    const json = '{"message":"Za\\u0161to da ne?","intent":"chat"}';
    expect(feedInOneShot(json)).toBe("Zašto da ne?");
    for (const size of [1, 2, 3]) {
      expect(feedInChunks(json, size)).toBe("Zašto da ne?");
    }
  });

  it("handles an empty message value", () => {
    const json = '{"message":"","intent":"chat"}';
    expect(feedInOneShot(json)).toBe("");
  });

  it("does not false-match a similarly-named key", () => {
    const json = '{"messageId":"abc123","message":"Zdravo!"}';
    expect(feedInOneShot(json)).toBe("Zdravo!");
  });

  it("ignores fields entirely when the target key never appears", () => {
    const json = '{"intent":"chat","quickReplies":["Da","Ne"]}';
    expect(feedInOneShot(json)).toBe("");
  });

  it("marks done once the closing quote is reached, ignoring trailing JSON", () => {
    const extractor = new StreamingJsonStringFieldExtractor("message");
    const emitted = extractor.push(
      '{"message":"kratka poruka","proposedItems":[{"productId":"x"}]}'
    );
    expect(emitted).toBe("kratka poruka");
    expect(extractor.done).toBe(true);
    // Feeding more after done should be a no-op.
    expect(extractor.push("more text")).toBe("");
  });

  it("streams progressively across multiple push() calls without duplication", () => {
    const extractor = new StreamingJsonStringFieldExtractor("message");
    let assembled = "";
    assembled += extractor.push('{"mess');
    assembled += extractor.push('age":"Dobro ');
    assembled += extractor.push('vece, ');
    assembled += extractor.push('izvolite?","in');
    assembled += extractor.push('tent":"chat"}');
    expect(assembled).toBe("Dobro vece, izvolite?");
  });
});
