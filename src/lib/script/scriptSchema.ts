import { z } from "zod";

export const ScriptSchema = z.object({
  text: z.string().min(1, "口播稿不能为空"),
  wordCount: z.number().optional(),
});

export type Script = z.infer<typeof ScriptSchema>;
