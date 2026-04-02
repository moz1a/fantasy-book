import { z } from "zod";

const choiceSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(24),
  text: z.string().min(1).max(1200),
}).strict();

const statsSchema = z.object({
  strength: z.number().int().min(0).max(99).optional(),
  agility: z.number().int().min(0).max(99).optional(),
  intelligence: z.number().int().min(0).max(99).optional(),
}).strict();

const sceneKindSchema = z.enum([
  "exploration",
  "social",
  "combat",
  "recovery",
  "mystery",
]);

const combatPatchSchema = z.object({
  active: z.boolean().optional(),
  enemyName: z.string().min(1).max(80).optional(),
  enemyHp: z.number().int().min(0).max(999).optional(),
  enemyMaxHp: z.number().int().min(1).max(999).optional(),
  enemyIntent: z.string().min(1).max(160).optional(),
  distance: z.enum(["far", "near", "melee"]).optional(),
  phase: z.enum(["opening", "exchange", "finisher"]).optional(),
}).strict();

const directorPatchSchema = z.object({
  sceneKind: sceneKindSchema.optional(),
  sceneGoal: z.string().min(1).max(160).optional(),
  tension: z.number().int().min(0).max(100).optional(),
  lastMajorEventTurn: z.number().int().min(0).max(9999).optional(),
  lastCombatTurn: z.number().int().min(0).max(9999).optional(),
  stallCount: z.number().int().min(0).max(99).optional(),
  addThreads: z.array(z.string().min(1).max(160)).max(10).optional(),
  removeThreads: z.array(z.string().min(1).max(160)).max(10).optional(),
}).strict();

export const gmReplySchema = z.object({
  narrative: z.string().min(1).max(2200),

  prompt: z
    .string()
    .min(1)
    .max(180),

  choices: z
    .array(choiceSchema)
    .length(3),

  worldSummary: z.string().min(1).max(1250),

  patch: z.object({
    hp: z.number().int().min(0).max(999).optional(),
    maxHp: z.number().int().min(1).max(999).optional(),
    gold: z.number().int().min(0).max(999999).optional(),
    location: z.string().min(1).max(120).optional(),

    stats: statsSchema.optional(),

    addItems: z
      .array(z.string().min(1).max(120))
      .max(20)
      .optional(),

    removeItems: z
      .array(z.string().min(1).max(120))
      .max(20)
      .optional(),

    addEffects: z
      .array(z.string().min(1).max(80))
      .max(10)
      .optional(),

    removeEffects: z
      .array(z.string().min(1).max(80))
      .max(10)
      .optional(),
  })
    .strict()
    .default({}),

  combatPatch: combatPatchSchema.default({}),
  directorPatch: directorPatchSchema.default({}),
}).strict();

export type GmReply = z.infer<typeof gmReplySchema>;