import { z } from "zod";

export const gmReplySchema = z.object({
  narrative: z.string().min(1),
  // короткое резюме мира/состояния, чтобы держать консистентность
  worldSummary: z.string().min(1),

  // изменения состояния (минимальный патч)
  patch: z.object({
    hp: z.number().int().min(0).max(999).optional(),
    gold: z.number().int().min(0).max(999999).optional(),
    location: z.string().min(1).optional(),
    addItems: z.array(z.string().min(1)).optional(),
    removeItems: z.array(z.string().min(1)).optional(),
  }).default({}),
});

export type GmReply = z.infer<typeof gmReplySchema>;
