import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import {
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { authComponent, createAuth } from "./auth";
import { decryptSecret, encryptSecret, hashPin } from "./lib/crypto";
import { GLOBAL_ROLE, ORG_ROLE } from "./lib/authz";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function splitName(fullName: string) {
  const trimmed = fullName.trim();
  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName: firstName || trimmed,
    lastName: rest.join(" ") || firstName || trimmed,
  };
}

function isGlobalSuperadmin(user: { role?: string | null }) {
  return user.role === GLOBAL_ROLE.SUPERADMIN;
}

function mapStaffRoleToAppRole(role: "staff" | "manager") {
  return role === "manager" ? "admin" : "staff";
}

function mapStaffRoleToOrganizationRole(role: "staff" | "manager") {
  return role === "manager" ? ORG_ROLE.MANAGER : ORG_ROLE.STAFF;
}

type AuthUserDoc = Awaited<ReturnType<typeof authComponent.safeGetAuthUser>> & {
  role?: string | null;
  banned?: boolean;
};

async function requireAuthUser(ctx: QueryCtx | MutationCtx) {
  const authUser = (await authComponent.safeGetAuthUser(ctx)) as AuthUserDoc;
  if (!authUser) {
    throw new ConvexError("Unauthenticated");
  }
  return authUser;
}

async function getSalonById(ctx: QueryCtx | MutationCtx, salonId: Id<"salon">) {
  const salon = await ctx.db.get(salonId);
  if (!salon) {
    throw new ConvexError("Salon not found");
  }
  return salon;
}

async function getEmployeeById(
  ctx: QueryCtx | MutationCtx,
  employeeId: Id<"employee">,
) {
  const employee = await ctx.db.get(employeeId);
  if (!employee) {
    throw new ConvexError("Employee not found");
  }
  return employee;
}

async function getOrCreateAppUserFromAuthUser(
  ctx: MutationCtx,
  authUser: {
    _id: string;
    email: string;
    name: string;
  },
  override?: Partial<{
    role: "client" | "staff" | "admin";
    salonId?: string;
    employeeId?: string;
  }>,
) {
  const existing = await ctx.db
    .query("appUser")
    .withIndex("authUserId", (query) => query.eq("authUserId", authUser._id))
    .unique();

  if (existing) {
    const patch = {
      email: authUser.email,
      fullName: authUser.name,
      updatedAt: Date.now(),
      ...(override?.role ? { role: override.role } : {}),
      ...(override?.salonId !== undefined ? { salonId: override.salonId } : {}),
      ...(override?.employeeId !== undefined
        ? { employeeId: override.employeeId }
        : {}),
    };
    await ctx.db.patch(existing._id, patch);
    return {
      ...existing,
      ...patch,
    };
  }

  const now = Date.now();
  const _id = await ctx.db.insert("appUser", {
    authUserId: authUser._id,
    email: authUser.email,
    fullName: authUser.name,
    phone: undefined,
    role: override?.role ?? "client",
    salonId: override?.salonId,
    employeeId: override?.employeeId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  const created = await ctx.db.get(_id);
  if (!created) {
    throw new ConvexError("Failed to create app user");
  }
  return created;
}

async function requireOrganizationRole(
  ctx: QueryCtx | MutationCtx,
  organizationId: string,
  userId: string,
  allowedRoles: string[],
) {
  const member = await ctx.db
    .query("member")
    .withIndex("organizationId_userId", (query) =>
      query.eq("organizationId", organizationId).eq("userId", userId),
    )
    .unique();

  if (!member) {
    throw new ConvexError("Not a member of this salon organization");
  }

  const roles = String(member.role).split(",").map((value) => value.trim());
  if (!roles.some((role) => allowedRoles.includes(role))) {
    throw new ConvexError("Not allowed for this salon");
  }

  return member;
}

async function getOrganizationMemberByUserId(
  ctx: QueryCtx | MutationCtx,
  organizationId: string,
  userId: string,
) {
  return ctx.db
    .query("member")
    .withIndex("organizationId_userId", (query) =>
      query.eq("organizationId", organizationId).eq("userId", userId),
    )
    .unique();
}

export const getViewerContext = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await requireAuthUser(ctx);
    const appUser = await ctx.db
      .query("appUser")
      .withIndex("authUserId", (query) => query.eq("authUserId", authUser._id))
      .unique();

    const salon = appUser?.salonId
      ? await ctx.db.get(appUser.salonId as never)
      : null;
    const employee = appUser?.employeeId
      ? await ctx.db.get(appUser.employeeId as never)
      : null;

    return {
      authUser,
      appUser: appUser ?? null,
      salon: salon ?? null,
      employee: employee ?? null,
    };
  },
});

export const ensureViewerProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const authUser = await requireAuthUser(ctx);
    return getOrCreateAppUserFromAuthUser(ctx, authUser);
  },
});

export const createSalonOrganization = mutation({
  args: {
    ownerAuthUserId: v.optional(v.id("user")),
    name: v.string(),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    phone: v.string(),
    email: v.string(),
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    postalCode: v.string(),
    city: v.string(),
    country: v.string(),
    timezone: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    logo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuthUser(ctx);
    const salonCount = await ctx.db.query("salon").collect();
    const isBootstrapCreate = salonCount.length === 0;

    if (!isBootstrapCreate && !isGlobalSuperadmin(authUser)) {
      throw new ConvexError("Only superadmins can create salons");
    }

    const ownerAuthUserId = args.ownerAuthUserId ?? authUser._id;
    const ownerAuthUser =
      ownerAuthUserId === authUser._id
        ? authUser
        : await authComponent.getAnyUserById(ctx, ownerAuthUserId);

    if (!ownerAuthUser) {
      throw new ConvexError("Owner auth user not found");
    }

    const ownerAppUser = await getOrCreateAppUserFromAuthUser(ctx, ownerAuthUser, {
      role: "admin",
    });

    const auth = createAuth(ctx);
    const slug = args.slug ?? slugify(args.name);
    const organization = await auth.api.createOrganization({
      body: {
        userId: ownerAuthUser._id,
        name: args.name,
        slug,
        logo: args.logo,
        metadata: {
          salonEmail: args.email,
          salonPhone: args.phone,
        },
      },
    });

    const now = Date.now();
    const salonId = await ctx.db.insert("salon", {
      organizationId: organization.id,
      name: args.name,
      slug,
      description: args.description,
      phone: args.phone,
      email: args.email,
      addressLine1: args.addressLine1,
      addressLine2: args.addressLine2,
      postalCode: args.postalCode,
      city: args.city,
      country: args.country,
      timezone: args.timezone,
      latitude: args.latitude,
      longitude: args.longitude,
      ownerAuthUserId: ownerAuthUser._id,
      ownerAppUserId: ownerAppUser._id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(ownerAppUser._id, {
      role: "admin",
      salonId: salonId,
      updatedAt: now,
    });

    const salon = await ctx.db.get(salonId);
    return {
      organization,
      salon,
    };
  },
});

export const createStaffAccount = mutation({
  args: {
    salonId: v.id("salon"),
    email: v.string(),
    fullName: v.string(),
    phone: v.optional(v.string()),
    bio: v.optional(v.string()),
    personalId: v.string(),
    workerPin: v.string(),
    role: v.union(v.literal("staff"), v.literal("manager")),
  },
  handler: async (ctx, args) => {
    const currentAuthUser = await requireAuthUser(ctx);
    const salon = await getSalonById(ctx, args.salonId);

    if (!salon.organizationId) {
      throw new ConvexError("Salon is not linked to an organization");
    }

    await requireOrganizationRole(ctx, salon.organizationId, currentAuthUser._id, [
      ORG_ROLE.OWNER,
      ORG_ROLE.MANAGER,
    ]);

    const existingEmployee = await ctx.db
      .query("employee")
      .withIndex("personalId", (query) => query.eq("personalId", args.personalId))
      .unique();
    if (existingEmployee) {
      throw new ConvexError("Personal ID is already in use");
    }

    const existingAuthUser = await ctx.db
      .query("user")
      .withIndex("email_name", (query) =>
        query.eq("email", args.email.toLowerCase()),
      )
      .first();
    if (existingAuthUser) {
      throw new ConvexError("A Better Auth user already exists with this email");
    }

    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    const staffLoginSecret = crypto.randomUUID();
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: args.email.toLowerCase(),
        password: staffLoginSecret,
        name: args.fullName,
      },
    });

    const staffAuthUser = signUpResult.user;
    const { firstName, lastName } = splitName(args.fullName);
    const workerPinHash = await hashPin(args.workerPin);
    const authLoginKey = await encryptSecret(staffLoginSecret);
    const now = Date.now();

    const employeeId = await ctx.db.insert("employee", {
      salonId: salon._id,
      userId: staffAuthUser.id,
      personalId: args.personalId,
      firstName,
      lastName,
      displayName: args.fullName,
      role: args.role,
      email: args.email.toLowerCase(),
      phone: args.phone,
      bio: args.bio,
      workerPinHash,
      authLoginKey,
      isAvailable: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const appUser = await getOrCreateAppUserFromAuthUser(
      ctx,
      {
        _id: staffAuthUser.id,
        email: staffAuthUser.email,
        name: staffAuthUser.name,
      },
      {
        role: mapStaffRoleToAppRole(args.role),
        salonId: salon._id,
        employeeId,
      },
    );

    await auth.api.addMember({
      headers,
      body: {
        userId: staffAuthUser.id,
        organizationId: salon.organizationId,
        role: mapStaffRoleToOrganizationRole(args.role),
      },
    });

    const employee = await ctx.db.get(employeeId);
    return {
      employee,
      appUser,
      authUserId: staffAuthUser.id,
    };
  },
});

export const updateStaffOrganizationRole = mutation({
  args: {
    employeeId: v.id("employee"),
    role: v.union(v.literal("staff"), v.literal("manager")),
  },
  handler: async (ctx, args) => {
    const currentAuthUser = await requireAuthUser(ctx);
    const employee = await getEmployeeById(ctx, args.employeeId);
    const salon = await getSalonById(ctx, employee.salonId as Id<"salon">);

    if (!employee.userId) {
      throw new ConvexError("Employee is not linked to an auth user");
    }
    if (!salon.organizationId) {
      throw new ConvexError("Salon is not linked to an organization");
    }

    await requireOrganizationRole(ctx, salon.organizationId, currentAuthUser._id, [
      ORG_ROLE.OWNER,
      ORG_ROLE.MANAGER,
    ]);

    const member = await getOrganizationMemberByUserId(
      ctx,
      salon.organizationId,
      employee.userId,
    );
    if (!member) {
      throw new ConvexError("Staff member is not part of the salon organization");
    }

    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    await auth.api.updateMemberRole({
      headers,
      body: {
        memberId: member._id,
        organizationId: salon.organizationId,
        role: mapStaffRoleToOrganizationRole(args.role),
      },
    });

    await ctx.db.patch(employee._id, {
      role: args.role,
      updatedAt: Date.now(),
    });

    const appUser = await ctx.db
      .query("appUser")
      .withIndex("employeeId", (query) => query.eq("employeeId", employee._id))
      .unique();
    if (appUser) {
      await ctx.db.patch(appUser._id, {
        role: mapStaffRoleToAppRole(args.role),
        updatedAt: Date.now(),
      });
    }

    return await ctx.db.get(employee._id);
  },
});

export const createBooking = mutation({
  args: {
    salonId: v.id("salon"),
    employeeId: v.id("employee"),
    serviceId: v.id("service"),
    startsAt: v.number(),
    endsAt: v.number(),
    customerName: v.string(),
    customerEmail: v.string(),
    customerPhone: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const salon = await getSalonById(ctx, args.salonId);
    const employee = await getEmployeeById(ctx, args.employeeId);
    const service = await ctx.db.get(args.serviceId);

    if (!service) {
      throw new ConvexError("Service not found");
    }
    if (employee.salonId !== salon._id || service.salonId !== salon._id) {
      throw new ConvexError("Booking resources must belong to the same salon");
    }
    if (!employee.isAvailable || !employee.isActive) {
      throw new ConvexError("Employee is not available for booking");
    }

    const overlappingBooking = await ctx.db
      .query("booking")
      .withIndex("employeeId_startsAt", (query) =>
        query.eq("employeeId", employee._id).gte("startsAt", args.startsAt),
      )
      .filter((query) =>
        query.and(
          query.neq(query.field("status"), "cancelled"),
          query.lt(query.field("startsAt"), args.endsAt),
        ),
      )
      .first();

    if (overlappingBooking && overlappingBooking.startsAt < args.endsAt) {
      throw new ConvexError("Selected slot is no longer available");
    }

    const authUser = await authComponent.safeGetAuthUser(ctx);
    const appUser = authUser
      ? await getOrCreateAppUserFromAuthUser(ctx, authUser)
      : null;

    const now = Date.now();
    const bookingId = await ctx.db.insert("booking", {
      salonId: salon._id,
      clientUserId: appUser?._id,
      employeeId: employee._id,
      serviceId: service._id,
      createdByUserId: appUser?._id,
      status: "confirmed",
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      notes: args.notes,
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      customerPhone: args.customerPhone,
      cancellationReason: undefined,
      cancelledAt: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(bookingId);
  },
});

export const cancelBooking = mutation({
  args: {
    bookingId: v.id("booking"),
    cancellationReason: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError("Booking not found");
    }
    if (booking.status === "cancelled") {
      return booking;
    }

    const authUser = await authComponent.safeGetAuthUser(ctx);
    let allowed = false;

    if (authUser) {
      const appUser = await ctx.db
        .query("appUser")
        .withIndex("authUserId", (query) => query.eq("authUserId", authUser._id))
        .unique();

      if (appUser?._id === booking.clientUserId) {
        allowed = true;
      } else {
        const salon = await getSalonById(ctx, booking.salonId as Id<"salon">);
        if (salon.organizationId) {
          try {
            await requireOrganizationRole(
              ctx,
              salon.organizationId,
              authUser._id,
              [ORG_ROLE.OWNER, ORG_ROLE.MANAGER, ORG_ROLE.STAFF],
            );
            allowed = true;
          } catch {
            allowed = false;
          }
        }
      }
    } else if (
      args.customerEmail &&
      args.customerPhone &&
      booking.customerEmail === args.customerEmail &&
      booking.customerPhone === args.customerPhone
    ) {
      allowed = true;
    }

    if (!allowed) {
      throw new ConvexError("Not allowed to cancel this booking");
    }

    await ctx.db.patch(booking._id, {
      status: "cancelled",
      cancellationReason:
        args.cancellationReason ?? "Cancelled by customer or staff",
      cancelledAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(booking._id);
  },
});

export const markEmployeeSickAndCancelBookings = mutation({
  args: {
    employeeId: v.id("employee"),
    cancellationReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentAuthUser = await requireAuthUser(ctx);
    const employee = await getEmployeeById(ctx, args.employeeId);
    const salon = await getSalonById(ctx, employee.salonId as Id<"salon">);

    if (!salon.organizationId) {
      throw new ConvexError("Salon is not linked to an organization");
    }
    if (!employee.userId) {
      throw new ConvexError("Employee is not linked to an auth user");
    }

    if (employee.userId === currentAuthUser._id) {
      await requireOrganizationRole(ctx, salon.organizationId, currentAuthUser._id, [
        ORG_ROLE.OWNER,
        ORG_ROLE.MANAGER,
        ORG_ROLE.STAFF,
      ]);
    } else {
      await requireOrganizationRole(ctx, salon.organizationId, currentAuthUser._id, [
        ORG_ROLE.OWNER,
        ORG_ROLE.MANAGER,
      ]);
    }

    await ctx.db.patch(employee._id, {
      isAvailable: false,
      updatedAt: Date.now(),
    });

    const now = Date.now();
    const activeBookings = await ctx.db
      .query("booking")
      .withIndex("employeeId_startsAt", (query) =>
        query.eq("employeeId", employee._id).gte("startsAt", now),
      )
      .filter((query) =>
        query.or(
          query.eq(query.field("status"), "pending"),
          query.eq(query.field("status"), "confirmed"),
        ),
      )
      .collect();

    const cancelledBookings = [];
    for (const booking of activeBookings) {
      await ctx.db.patch(booking._id, {
        status: "cancelled",
        cancellationReason:
          args.cancellationReason ?? "Automatically cancelled due to staff illness",
        cancelledAt: now,
        updatedAt: now,
      });
      const updated = await ctx.db.get(booking._id);
      if (updated) {
        cancelledBookings.push(updated);
      }
    }

    return {
      employee: (await ctx.db.get(employee._id)) ?? employee,
      cancelledCount: cancelledBookings.length,
      bookings: cancelledBookings,
    };
  },
});

export const getStaffLoginPayload = internalQuery({
  args: {
    personalId: v.string(),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    const employee = await ctx.db
      .query("employee")
      .withIndex("personalId", (query) => query.eq("personalId", args.personalId))
      .unique();

    if (!employee || !employee.isActive || !employee.isAvailable) {
      return null;
    }

    const pinHash = await hashPin(args.pin);
    if (employee.workerPinHash !== pinHash) {
      return null;
    }

    if (!employee.userId || !employee.email || !employee.authLoginKey) {
      return null;
    }

    const authUser = (await authComponent.getAnyUserById(
      ctx,
      employee.userId,
    )) as AuthUserDoc | null;
    if (!authUser || authUser.banned) {
      return null;
    }

    const salon = await ctx.db.get(employee.salonId as Id<"salon">);
    if (!salon) {
      return null;
    }

    return {
      employee,
      salon,
      email: employee.email,
      loginSecret: await decryptSecret(employee.authLoginKey),
    };
  },
});
