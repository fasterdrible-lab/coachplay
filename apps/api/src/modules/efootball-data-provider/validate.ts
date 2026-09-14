import { z } from 'zod';

const cardSchema = z.object({
  externalId: z.string().min(1),
  cardType: z.string().min(1),
  version: z.string().min(1),
  overallBase: z.number().int().min(1).max(99),
  maxLevel: z.number().int().min(1),
  position: z.string().min(1),
  imageUrl: z.string().optional(),
  releaseDate: z.string().optional(),
  stats: z.record(z.number()).optional(),
  skills: z.array(z.string()).optional(),
  playStyles: z.array(z.object({ key: z.string(), tier: z.string().optional() })).optional(),
});

const playerRecordSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  nationality: z.string().optional(),
  preferredFoot: z.string().optional(),
  height: z.number().int().positive().optional(),
  cards: z.array(cardSchema).min(1),
});

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Passo "validate" do pipeline — rejeita registros fora de forma/faixa antes de qualquer
 * escrita no banco (ex.: overallBase fora de 1-99, carta sem posição). */
export function validateRecord(raw: unknown): ValidationResult {
  const result = playerRecordSchema.safeParse(raw);
  if (result.success) return { valid: true, errors: [] };

  return {
    valid: false,
    errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  };
}
