import { z } from "zod";

export const relationTypeSchema = z.enum(["parent_child", "affiliate", "fc_vc"]);
export type RelationType = z.infer<typeof relationTypeSchema>;

export const corporateRelationRevisionSchema = z.object({
  valid_from: z.string(),
  valid_to: z.string().nullable(),
  evidence: z.string(),
  recorded_at: z.string(),
  recorded_by: z.string().nullable().optional(),
});
export type CorporateRelationRevision = z.infer<typeof corporateRelationRevisionSchema>;

export const corporateRelationRevisionListSchema = z.array(corporateRelationRevisionSchema);

export const corporateRelationSchema = z.object({
  id: z.string().min(1),
  source_corporation_id: z.string().min(1),
  target_corporation_id: z.string().min(1),
  relation_type: relationTypeSchema,
  valid_from: z.string(),
  valid_to: z.string().nullable(),
  evidence: z.string(),
  recorded_at: z.string(),
  recorded_by: z.string().nullable().optional(),
});
export type CorporateRelation = z.infer<typeof corporateRelationSchema>;

export const corporateRelationListSchema = z.object({
  items: z.array(corporateRelationSchema),
  total: z.number().int().nonnegative(),
});
export type CorporateRelationList = z.infer<typeof corporateRelationListSchema>;

export interface CorporateRelationListFilter {
  corporation_id?: string;
  as_of?: string;
  relation_type?: RelationType;
}
