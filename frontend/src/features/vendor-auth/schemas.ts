import { z } from "zod";

export const vendorRoleSchema = z.enum(["admin", "member"]);
export type VendorRole = z.infer<typeof vendorRoleSchema>;

export const vendorUserStatusSchema = z.enum(["active", "disabled"]);
export type VendorUserStatus = z.infer<typeof vendorUserStatusSchema>;

export const vendorUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  display_name: z.string().min(1),
  role: vendorRoleSchema,
  status: vendorUserStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type VendorUser = z.infer<typeof vendorUserSchema>;

export const vendorAuthSessionSchema = z.object({
  user: vendorUserSchema,
  access_token_expires_in_seconds: z.number().int().positive(),
  refresh_token_expires_in_seconds: z.number().int().positive(),
});
export type VendorAuthSession = z.infer<typeof vendorAuthSessionSchema>;

export const vendorUserListSchema = z.object({
  items: z.array(vendorUserSchema),
  total: z.number().int().nonnegative(),
});
export type VendorUserList = z.infer<typeof vendorUserListSchema>;
