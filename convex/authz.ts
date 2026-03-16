import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";
import type { Doc, Id } from "./_generated/dataModel";
import type { UserRole } from "./domain";

type Ctx = QueryCtx | MutationCtx;
type AppUserDoc = Doc<"appUsers">;

const roleRank: Record<UserRole, number> = {
  client: 0,
  staff: 1,
  admin: 2,
};

export async function requireViewer(ctx: Ctx) {
  const authUser = await authComponent.getAuthUser(ctx);
  const appUser = await ctx.db
    .query("appUsers")
    .withIndex("authUserId", (query) => query.eq("authUserId", authUser._id))
    .unique();

  if (!appUser) {
    throw new ConvexError("App user profile is missing.");
  }

  if (!appUser.isActive) {
    throw new ConvexError("User profile is inactive.");
  }

  return { authUser, appUser };
}

export async function requireRole(ctx: Ctx, minimumRole: UserRole) {
  const viewer = await requireViewer(ctx);
  if (roleRank[viewer.appUser.role] < roleRank[minimumRole]) {
    throw new ConvexError("Insufficient permissions.");
  }
  return viewer;
}

export function canAccessSalon(appUser: AppUserDoc, salonId: Id<"salons">) {
  return appUser.role === "admin" || appUser.salonId === salonId;
}

export function assertSalonAccess(appUser: AppUserDoc, salonId: Id<"salons">) {
  if (!canAccessSalon(appUser, salonId)) {
    throw new ConvexError("User does not have access to this salon.");
  }
}
