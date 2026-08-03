import { z } from "zod";

export const PersonaSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  personality: z.object({
    tone: z.string(),
    style: z.string(),
    catchphrase: z.string().optional(),
    traits: z.array(z.string()).optional(),
  }),
  speaking_style: z.object({
    pace_description: z.string().optional(),
    target_word_count: z.number().optional(),
    sentence_structure: z.string().optional(),
    emphasis_rules: z.string().optional(),
    paragraph_breaks: z.string().optional(),
    forbidden: z.array(z.string()).optional(),
  }),
  content_preferences: z
    .object({
      topics: z.array(z.string()).optional(),
      angle: z.string().optional(),
      depth: z.string().optional(),
    })
    .optional(),
  audience: z
    .object({
      profile: z.string().optional(),
      expectation: z.string().optional(),
    })
    .optional(),
});

export type Persona = z.infer<typeof PersonaSchema>;
