import type { Patch } from "./types.js";

function stripCodeFences(text: string): string {
  const trimmed = text.trim().replace(/^\uFEFF/, "");
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (match?.[1] ?? trimmed).trim();
}

function extractFirstJsonObject(text: string): string {
  const input = stripCodeFences(text);

  const start = input.search(/[{[]/);
  if (start === -1) {
    throw new Error("Model response does not contain JSON");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < input.length; i++) {
    const ch = input[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === "\\") {
        escaped = true;
        continue;
      }

      if (ch === "\"") {
        inString = false;
      }

      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      depth++;
      continue;
    }

    if (ch === "}" || ch === "]") {
      depth--;

      if (depth === 0) {
        return input.slice(start, i + 1).trim();
      }

      if (depth < 0) {
        break;
      }
    }
  }

  throw new Error("Could not extract a complete JSON object from model response");
}

function sanitizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const arr = value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 20);

  return arr.length > 0 ? arr : undefined;
}

function sanitizePatch(input: unknown): Patch {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const src = input as Record<string, unknown>;
  const patch: Patch = {};

  if (typeof src.hp === "number" && Number.isInteger(src.hp)) {
    patch.hp = src.hp;
  }

  if (typeof src.gold === "number" && Number.isInteger(src.gold)) {
    patch.gold = src.gold;
  }

  if (typeof src.location === "string" && src.location.trim()) {
    patch.location = src.location.trim();
  }

  const addItems = sanitizeStringArray(src.addItems);
  if (addItems) patch.addItems = addItems;

  const removeItems = sanitizeStringArray(src.removeItems);
  if (removeItems) patch.removeItems = removeItems;

  return patch;
}

function normalizeModelReply(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const src = input as Record<string, unknown>;

  return {
    narrative: src.narrative,
    prompt: src.prompt,
    choices: src.choices,
    worldSummary: src.worldSummary,
    patch: sanitizePatch(src.patch),
  };
}

export function parseAndNormalizeModelJson(rawContent: string) {
  const normalizedText = extractFirstJsonObject(rawContent);

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizedText);
  } catch {
    throw new Error(`Model content is not valid JSON: ${normalizedText}`);
  }

  return {
    normalizedText,
    parsed,
    normalizedObject: normalizeModelReply(parsed),
  };
}