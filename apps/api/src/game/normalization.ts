import type { CombatPatch, DirectorPatch, Patch } from "./types.js";

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

      if (ch === '"') {
        inString = false;
      }

      continue;
    }

    if (ch === '"') {
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

  throw new Error(
    "Could not extract a complete JSON object from model response",
  );
}

function sanitizeString(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  return trimmed.slice(0, maxLen);
}

function sanitizeInteger(
  value: unknown,
  min?: number,
  max?: number,
): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return undefined;
  }

  if (min !== undefined && value < min) return undefined;
  if (max !== undefined && value > max) return undefined;

  return value;
}

function sanitizeStringArray(
  value: unknown,
  maxItems = 20,
  maxItemLen = 120,
): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const arr = value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => v.slice(0, maxItemLen))
    .slice(0, maxItems);

  return arr.length > 0 ? arr : undefined;
}

function sanitizeStatsPatch(value: unknown): Patch["stats"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const src = value as Record<string, unknown>;
  const stats: NonNullable<Patch["stats"]> = {};

  const strength = sanitizeInteger(src.strength, 0, 99);
  if (strength !== undefined) {
    stats.strength = strength;
  }

  const agility = sanitizeInteger(src.agility, 0, 99);
  if (agility !== undefined) {
    stats.agility = agility;
  }

  const intelligence = sanitizeInteger(src.intelligence, 0, 99);
  if (intelligence !== undefined) {
    stats.intelligence = intelligence;
  }

  return Object.keys(stats).length > 0 ? stats : undefined;
}

function sanitizePatch(input: unknown): Patch {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const src = input as Record<string, unknown>;
  const patch: Patch = {};

  const hp = sanitizeInteger(src.hp, 0, 999);
  if (hp !== undefined) {
    patch.hp = hp;
  }

  const maxHp = sanitizeInteger(src.maxHp, 1, 999);
  if (maxHp !== undefined) {
    patch.maxHp = maxHp;
  }

  const gold = sanitizeInteger(src.gold, 0, 999999);
  if (gold !== undefined) {
    patch.gold = gold;
  }

  const location = sanitizeString(src.location, 120);
  if (location) {
    patch.location = location;
  }

  const stats = sanitizeStatsPatch(src.stats);
  if (stats) {
    patch.stats = stats;
  }

  const addItems = sanitizeStringArray(src.addItems, 20, 120);
  if (addItems) {
    patch.addItems = addItems;
  }

  const removeItems = sanitizeStringArray(src.removeItems, 20, 120);
  if (removeItems) {
    patch.removeItems = removeItems;
  }

  const addEffects = sanitizeStringArray(src.addEffects, 10, 80);
  if (addEffects) {
    patch.addEffects = addEffects;
  }

  const removeEffects = sanitizeStringArray(src.removeEffects, 10, 80);
  if (removeEffects) {
    patch.removeEffects = removeEffects;
  }

  return patch;
}

function sanitizeCombatPatch(input: unknown): CombatPatch {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const src = input as Record<string, unknown>;
  const patch: CombatPatch = {};

  if (typeof src.active === "boolean") {
    patch.active = src.active;
  }

  const enemyName = sanitizeString(src.enemyName, 80);
  if (enemyName) {
    patch.enemyName = enemyName;
  }

  const enemyHp = sanitizeInteger(src.enemyHp, 0, 999);
  if (enemyHp !== undefined) {
    patch.enemyHp = enemyHp;
  }

  const enemyMaxHp = sanitizeInteger(src.enemyMaxHp, 1, 999);
  if (enemyMaxHp !== undefined) {
    patch.enemyMaxHp = enemyMaxHp;
  }

  const enemyIntent = sanitizeString(src.enemyIntent, 160);
  if (enemyIntent) {
    patch.enemyIntent = enemyIntent;
  }

  if (
    src.distance === "far" ||
    src.distance === "near" ||
    src.distance === "melee"
  ) {
    patch.distance = src.distance;
  }

  if (
    src.phase === "opening" ||
    src.phase === "exchange" ||
    src.phase === "finisher"
  ) {
    patch.phase = src.phase;
  }

  return patch;
}

function sanitizeDirectorPatch(input: unknown): DirectorPatch {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const src = input as Record<string, unknown>;
  const patch: DirectorPatch = {};

  if (
    src.sceneKind === "exploration" ||
    src.sceneKind === "social" ||
    src.sceneKind === "combat" ||
    src.sceneKind === "recovery" ||
    src.sceneKind === "mystery"
  ) {
    patch.sceneKind = src.sceneKind;
  }

  const sceneGoal = sanitizeString(src.sceneGoal, 160);
  if (sceneGoal) {
    patch.sceneGoal = sceneGoal;
  }

  const tension = sanitizeInteger(src.tension, 0, 100);
  if (tension !== undefined) {
    patch.tension = tension;
  }

  const lastMajorEventTurn = sanitizeInteger(src.lastMajorEventTurn, 0, 9999);
  if (lastMajorEventTurn !== undefined) {
    patch.lastMajorEventTurn = lastMajorEventTurn;
  }

  const lastCombatTurn = sanitizeInteger(src.lastCombatTurn, 0, 9999);
  if (lastCombatTurn !== undefined) {
    patch.lastCombatTurn = lastCombatTurn;
  }

  const stallCount = sanitizeInteger(src.stallCount, 0, 99);
  if (stallCount !== undefined) {
    patch.stallCount = stallCount;
  }

  const addThreads = sanitizeStringArray(src.addThreads, 10, 160);
  if (addThreads) {
    patch.addThreads = addThreads;
  }

  const removeThreads = sanitizeStringArray(src.removeThreads, 10, 160);
  if (removeThreads) {
    patch.removeThreads = removeThreads;
  }

  return patch;
}

function normalizeChoices(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object" && !Array.isArray(item),
    )
    .map((item) => {
      const id = sanitizeString(item.id, 24);
      const text = sanitizeString(item.text, 1200);

      return {
        id,
        text,
      };
    })
    .filter((item) => item.id && item.text);
}

function normalizeModelReply(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const src = input as Record<string, unknown>;

  return {
    narrative: sanitizeString(src.narrative, 2200) ?? src.narrative,
    prompt: sanitizeString(src.prompt, 180) ?? src.prompt,
    choices: normalizeChoices(src.choices),
    worldSummary: sanitizeString(src.worldSummary, 1250) ?? src.worldSummary,
    patch: sanitizePatch(src.patch),
    combatPatch: sanitizeCombatPatch(src.combatPatch),
    directorPatch: sanitizeDirectorPatch(src.directorPatch),
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
