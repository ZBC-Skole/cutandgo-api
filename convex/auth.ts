import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { admin, organization } from "better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import { getAuthBaseUrl, getTrustedOrigins } from "./lib/authEnv";
import {
  ac,
  adminRoles,
  organizationRoles,
} from "./lib/authz";

export const authComponent = createClient<DataModel>(components.betterAuth);

export function createAuth(ctx: GenericCtx<DataModel>) {
  const baseURL = getAuthBaseUrl();

  return betterAuth({
    baseURL,
    trustedOrigins: getTrustedOrigins(),
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      admin({
        ac,
        roles: adminRoles,
        defaultRole: "user",
        adminRoles: ["superadmin"],
      }),
      organization({
        ac,
        roles: organizationRoles,
        creatorRole: "owner",
      }),
      convex({
        authConfig,
      }),
    ],
  });
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
