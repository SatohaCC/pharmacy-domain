import { z } from "zod";

export const corporationCategorySchema = z.enum(["corporation", "individual"]);
export type CorporationCategory = z.infer<typeof corporationCategorySchema>;

export const corporationStatusSchema = z.enum(["active", "dissolved", "merged_out"]);
export type CorporationStatus = z.infer<typeof corporationStatusSchema>;

export const corporationUsageStatusSchema = z.enum(["not_started", "active", "suspended"]);
export type CorporationUsageStatus = z.infer<typeof corporationUsageStatusSchema>;

export const corporationSchema = z.object({
  id: z.string().min(1),
  category: corporationCategorySchema,
  name: z.string().min(1),
  representative_name: z.string().default(""),
  corporate_number: z.string().nullable(),
  address: z.string(),
  status: corporationStatusSchema,
  usage_status: corporationUsageStatusSchema.optional(),
  created_at: z.string(),
  updated_at: z.string(),
  valid_from: z.string().nullable().optional(),
  valid_to: z.string().nullable().optional(),
});
export type Corporation = z.infer<typeof corporationSchema>;

export const corporationListSchema = z.object({
  items: z.array(corporationSchema),
  total: z.number().int().nonnegative(),
});
export type CorporationList = z.infer<typeof corporationListSchema>;

export const corporationChangeKindSchema = z.enum([
  "registration",
  "profile",
  "dissolution",
  "merger",
  "correction",
  "legacy",
]);
export type CorporationChangeKind = z.infer<typeof corporationChangeKindSchema>;

export const corporationHistoryRecordSchema = z.object({
  corporation: corporationSchema,
  valid_from: z.string(),
  valid_to: z.string().nullable(),
  recorded_at: z.string(),
  kind: corporationChangeKindSchema,
  evidence: z.string().nullable(),
  surviving_corporation_id: z.string().nullable(),
  recorded_by: z.string().nullable().optional(),
});
export type CorporationHistoryRecord = z.infer<typeof corporationHistoryRecordSchema>;

export const corporationHistoryListSchema = z.array(corporationHistoryRecordSchema);

export interface CorporationListFilter {
  q?: string;
  category?: CorporationCategory;
  status?: CorporationStatus;
  usage_status?: CorporationUsageStatus;
}
