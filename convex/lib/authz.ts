import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements as adminDefaultStatements,
  adminAc as platformAdminAc,
  userAc as platformUserAc,
} from "better-auth/plugins/admin/access";
import {
  defaultStatements as organizationDefaultStatements,
  adminAc as orgAdminAc,
  memberAc as orgMemberAc,
  ownerAc as orgOwnerAc,
} from "better-auth/plugins/organization/access";

export const GLOBAL_ROLE = {
  USER: "user",
  SUPERADMIN: "superadmin",
} as const;

export const ORG_ROLE = {
  OWNER: "owner",
  MANAGER: "manager",
  STAFF: "staff",
  ADMIN: "admin",
  MEMBER: "member",
} as const;

export const permissionStatements = {
  ...adminDefaultStatements,
  ...organizationDefaultStatements,
  salon: ["create", "read", "update", "delete"],
  booking: ["create", "read", "update", "delete", "cancel", "manage"],
  service: ["create", "read", "update", "delete"],
  product: ["create", "read", "update", "delete"],
  openingHours: ["create", "read", "update", "delete"],
  employee: ["create", "read", "update", "delete", "set-role", "mark-sick"],
  viewer: ["read"],
} as const;

export const ac = createAccessControl(permissionStatements);

export const platformUserRole = ac.newRole({
  ...platformUserAc.statements,
  viewer: ["read"],
  booking: ["create", "read", "cancel"],
});

export const superadminRole = ac.newRole({
  ...platformAdminAc.statements,
  salon: ["create", "read", "update", "delete"],
  booking: ["create", "read", "update", "delete", "cancel", "manage"],
  service: ["create", "read", "update", "delete"],
  product: ["create", "read", "update", "delete"],
  openingHours: ["create", "read", "update", "delete"],
  employee: ["create", "read", "update", "delete", "set-role", "mark-sick"],
  viewer: ["read"],
});

export const organizationOwnerRole = ac.newRole({
  ...orgOwnerAc.statements,
  salon: ["read", "update"],
  booking: ["read", "update", "cancel", "manage"],
  service: ["create", "read", "update", "delete"],
  product: ["create", "read", "update", "delete"],
  openingHours: ["create", "read", "update", "delete"],
  employee: ["create", "read", "update", "delete", "set-role", "mark-sick"],
  viewer: ["read"],
});

export const organizationManagerRole = ac.newRole({
  ...orgAdminAc.statements,
  salon: ["read", "update"],
  booking: ["read", "update", "cancel", "manage"],
  service: ["create", "read", "update", "delete"],
  product: ["create", "read", "update", "delete"],
  openingHours: ["create", "read", "update", "delete"],
  employee: ["create", "read", "update", "set-role", "mark-sick"],
  viewer: ["read"],
});

export const organizationStaffRole = ac.newRole({
  ...orgMemberAc.statements,
  booking: ["read", "update"],
  service: ["read"],
  product: ["read"],
  openingHours: ["read"],
  employee: ["read", "mark-sick"],
  viewer: ["read"],
});

export const adminRoles = {
  user: platformUserRole,
  superadmin: superadminRole,
} as const;

export const organizationRoles = {
  owner: organizationOwnerRole,
  manager: organizationManagerRole,
  staff: organizationStaffRole,
  admin: organizationManagerRole,
  member: organizationStaffRole,
} as const;
