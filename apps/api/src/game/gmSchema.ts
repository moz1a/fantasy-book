import { z } from "zod";

const choiceSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(24)
    // опционально можно ограничить латиницей + дефисами
    .regex(/^[a-z0-9_-]+$/, "id must be lowercase latin, numbers, _ or -"),
  text: z.string().min(1).max(160),
}).strict();

export const gmReplySchema = z.object({
  narrative: z.string().min(1).max(900),

  prompt: z
    .string()
    .min(1)
    .max(180),

  choices: z
    .array(choiceSchema)
    .length(3), // строго 3 варианта

  worldSummary: z.string().min(1).max(650),

  patch: z.object({
    hp: z.number().int().min(0).max(999).optional(),
    gold: z.number().int().min(0).max(999999).optional(),
    location: z.string().min(1).optional(),

    addItems: z
      .array(z.string().min(1))
      .max(20)
      .optional(),

    removeItems: z
      .array(z.string().min(1))
      .max(20)
      .optional(),
  })
  .strict()
  .default({}),
}).strict();

export type GmReply = z.infer<typeof gmReplySchema>;