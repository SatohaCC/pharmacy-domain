import { z } from "zod";

export const affiliationTypeSchema = z.enum(["vendor", "tenant"]);
export type AffiliationType = z.infer<typeof affiliationTypeSchema>;

export const authRoleSchema = z.enum([
  "vendor_admin",
  "vendor_member",
  "tenant_admin",
  "pharmacist",
  "clerk",
]);
export type AuthRole = z.infer<typeof authRoleSchema>;

export const vendorAssignableRoleSchema = z.enum(["vendor_admin", "vendor_member"]);
export type VendorAssignableRole = z.infer<typeof vendorAssignableRoleSchema>;

export const authUserStatusSchema = z.enum(["active", "disabled"]);
export type AuthUserStatus = z.infer<typeof authUserStatusSchema>;

export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  display_name: z.string().min(1),
  affiliation_type: affiliationTypeSchema,
  tenant_id: z.string().nullable(),
  roles: z.array(authRoleSchema),
  status: authUserStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authSessionSchema = z.object({
  user: authUserSchema,
  access_token_expires_in_seconds: z.number().int().positive(),
  refresh_token_expires_in_seconds: z.number().int().positive(),
});
export type AuthSession = z.infer<typeof authSessionSchema>;

export const authUserListSchema = z.object({
  items: z.array(authUserSchema),
  total: z.number().int().nonnegative(),
});
export type AuthUserList = z.infer<typeof authUserListSchema>;
