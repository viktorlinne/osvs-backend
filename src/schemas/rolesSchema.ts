import { z } from "zod";

export const RoleValues = ["Admin", "Editor", "Member"] as const;
export const roleValueSchema = z.enum(
  RoleValues as unknown as [string, string, string],
);

export const roleSchema = z.object({
  id: z.number().int(),
  role: roleValueSchema,
});

export type RoleValue = z.infer<typeof roleValueSchema>;
export type Role = z.infer<typeof roleSchema>;

export function isValidRole(r: unknown): r is RoleValue {
  return typeof r === "string" && (RoleValues as readonly string[]).includes(r);
}

export const setRolesSchema = z.object({
  roleIds: z.array(z.number().int()).optional(),
});

export type SetRolesBody = z.infer<typeof setRolesSchema>;

export default {
  roleSchema,
  roleValueSchema,
  RoleValues,
  isValidRole,
  setRolesSchema,
};
