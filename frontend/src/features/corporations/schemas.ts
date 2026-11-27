import { z } from "zod";

export const corporationCategorySchema = z.enum(["corporation", "individual"]);
export type CorporationCategory = z.infer<typeof corporationCategorySchema>;

export const corporationStatusSchema = z.enum(["active", "dissolved", "merged_out"]);
export type CorporationStatus = z.infer<typeof corporationStatusSchema>;

export const corporationSchema = z.object({
  id: z.string().min(1),
  category: corporationCategorySchema,
  name: z.string().min(1),
  corporate_number: z.string().nullable(),
  address: z.string(),
  status: corporationStatusSchema,
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

export interface CorporationListFilter {
  q?: string;
  category?: CorporationCategory;
  status?: CorporationStatus;
}
