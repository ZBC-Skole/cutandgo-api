import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  bookingInputValidator,
  bookingStatusValidator,
  employeeInputValidator,
  openingHoursInputValidator,
  productInputValidator,
  salonInputValidator,
  sanitizeOptionalText,
  serviceInputValidator,
  userRoleValidator,
  validateDateRange,
  validateEmail,
  validateMoney,
  validateNonNegativeInteger,
  validatePhone,
  validatePositiveInteger,
  validateRequiredString,
  validateSlug,
  validateTimeString,
} from "./domain";
import { authComponent } from "./auth";
import { assertSalonAccess, requireRole, requireViewer } from "./authz";

export const ensureCurrentUserProfile = mutation({
  args: {
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    const now = Date.now();
    const existingProfiles = await ctx.db.query("appUsers").take(1);
    const existing = await ctx.db
      .query("appUsers")
      .withIndex("authUserId", (query) => query.eq("authUserId", authUser._id))
      .unique();

    const phone = args.phone ? validatePhone(args.phone) : undefined;
    const fullName = validateRequiredString("Full name", authUser.name, 2);
    const email = validateEmail(authUser.email);

    if (existing) {
      await ctx.db.patch(existing._id, {
        email,
        fullName,
        phone: phone ?? existing.phone,
        updatedAt: now,
      });
      return await ctx.db.get(existing._id);
    }

    const appUserId = await ctx.db.insert("appUsers", {
      authUserId: authUser._id,
      email,
      fullName,
      phone,
      role: existingProfiles.length === 0 ? "admin" : "client",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(appUserId);
  },
});

export const getViewerContext = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);

    const [salon, employee] = await Promise.all([
      viewer.appUser.salonId ? ctx.db.get(viewer.appUser.salonId) : null,
      viewer.appUser.employeeId ? ctx.db.get(viewer.appUser.employeeId) : null,
    ]);

    return {
      authUser: viewer.authUser,
      appUser: viewer.appUser,
      salon,
      employee,
    };
  },
});

export const listSalons = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("salons")
      .withIndex("isActive", (query) => query.eq("isActive", true))
      .collect();
  },
});

export const getSalonFoundation = query({
  args: {
    salonId: v.id("salons"),
  },
  handler: async (ctx, args) => {
    const salon = await ctx.db.get(args.salonId);
    if (!salon) {
      throw new ConvexError("Salon not found.");
    }

    const [employees, services, openingHours, products] = await Promise.all([
      ctx.db
        .query("employees")
        .withIndex("salonId_isActive", (query) =>
          query.eq("salonId", args.salonId).eq("isActive", true),
        )
        .collect(),
      ctx.db
        .query("services")
        .withIndex("salonId_isActive", (query) =>
          query.eq("salonId", args.salonId).eq("isActive", true),
        )
        .collect(),
      ctx.db
        .query("openingHours")
        .withIndex("salonId", (query) => query.eq("salonId", args.salonId))
        .collect(),
      ctx.db
        .query("products")
        .withIndex("salonId_isActive", (query) =>
          query.eq("salonId", args.salonId).eq("isActive", true),
        )
        .collect(),
    ]);

    return {
      salon,
      employees,
      services,
      openingHours,
      products,
    };
  },
});

export const createSalon = mutation({
  args: salonInputValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireRole(ctx, "admin");
    const now = Date.now();
    const slug = validateSlug(args.slug);

    const existing = await ctx.db
      .query("salons")
      .withIndex("slug", (query) => query.eq("slug", slug))
      .unique();
    if (existing) {
      throw new ConvexError("Salon slug already exists.");
    }

    const salonId = await ctx.db.insert("salons", {
      name: validateRequiredString("Salon name", args.name, 2),
      slug,
      description: sanitizeOptionalText(args.description),
      phone: validatePhone(args.phone),
      email: validateEmail(args.email),
      addressLine1: validateRequiredString("Address line 1", args.addressLine1, 3),
      addressLine2: sanitizeOptionalText(args.addressLine2),
      postalCode: validateRequiredString("Postal code", args.postalCode, 3),
      city: validateRequiredString("City", args.city, 2),
      country: validateRequiredString("Country", args.country, 2),
      timezone: validateRequiredString("Timezone", args.timezone, 2),
      ownerUserId: appUser._id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(salonId);
  },
});

export const createEmployee = mutation({
  args: employeeInputValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireRole(ctx, "staff");
    assertSalonAccess(appUser, args.salonId);

    const salon = await ctx.db.get(args.salonId);
    if (!salon) {
      throw new ConvexError("Salon not found.");
    }

    const now = Date.now();
    const employeeId = await ctx.db.insert("employees", {
      salonId: args.salonId,
      firstName: validateRequiredString("First name", args.firstName, 2),
      lastName: validateRequiredString("Last name", args.lastName, 2),
      displayName: validateRequiredString("Display name", args.displayName, 2),
      role: args.role,
      email: args.email ? validateEmail(args.email) : undefined,
      phone: args.phone ? validatePhone(args.phone) : undefined,
      bio: sanitizeOptionalText(args.bio),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(employeeId);
  },
});

export const createService = mutation({
  args: serviceInputValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireRole(ctx, "staff");
    assertSalonAccess(appUser, args.salonId);

    const [salon, employees] = await Promise.all([
      ctx.db.get(args.salonId),
      Promise.all(args.employeeIds.map((employeeId) => ctx.db.get(employeeId))),
    ]);

    if (!salon) {
      throw new ConvexError("Salon not found.");
    }

    if (employees.some((employee) => !employee || employee.salonId !== args.salonId)) {
      throw new ConvexError("All assigned employees must belong to the same salon.");
    }

    const now = Date.now();
    const serviceId = await ctx.db.insert("services", {
      salonId: args.salonId,
      name: validateRequiredString("Service name", args.name, 2),
      description: sanitizeOptionalText(args.description),
      durationMinutes: validatePositiveInteger("Duration minutes", args.durationMinutes),
      priceDkk: validateMoney("Price", args.priceDkk),
      category: sanitizeOptionalText(args.category),
      employeeIds: args.employeeIds,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(serviceId);
  },
});

export const createBooking = mutation({
  args: bookingInputValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireViewer(ctx);
    validateDateRange(args.startsAt, args.endsAt);

    const [salon, employee, service] = await Promise.all([
      ctx.db.get(args.salonId),
      ctx.db.get(args.employeeId),
      ctx.db.get(args.serviceId),
    ]);

    if (!salon) {
      throw new ConvexError("Salon not found.");
    }
    if (!employee || employee.salonId !== args.salonId) {
      throw new ConvexError("Employee does not belong to the salon.");
    }
    if (!service || service.salonId !== args.salonId) {
      throw new ConvexError("Service does not belong to the salon.");
    }
    if (!service.employeeIds.includes(args.employeeId)) {
      throw new ConvexError("Employee is not assigned to the selected service.");
    }

    const bookingId = await ctx.db.insert("bookings", {
      salonId: args.salonId,
      clientUserId: appUser._id,
      employeeId: args.employeeId,
      serviceId: args.serviceId,
      createdByUserId: appUser._id,
      status: "pending",
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      notes: sanitizeOptionalText(args.notes),
      customerName: validateRequiredString("Customer name", args.customerName, 2),
      customerEmail: validateEmail(args.customerEmail),
      customerPhone: validatePhone(args.customerPhone),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(bookingId);
  },
});

export const updateBookingStatus = mutation({
  args: {
    bookingId: v.id("bookings"),
    status: bookingStatusValidator,
  },
  handler: async (ctx, args) => {
    const { appUser } = await requireRole(ctx, "staff");
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError("Booking not found.");
    }

    assertSalonAccess(appUser, booking.salonId);
    await ctx.db.patch(args.bookingId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.bookingId);
  },
});

export const createProduct = mutation({
  args: productInputValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireRole(ctx, "staff");
    assertSalonAccess(appUser, args.salonId);

    const salon = await ctx.db.get(args.salonId);
    if (!salon) {
      throw new ConvexError("Salon not found.");
    }

    const sku = sanitizeOptionalText(args.sku);
    if (sku) {
      const existing = await ctx.db
        .query("products")
        .withIndex("sku", (query) => query.eq("sku", sku))
        .unique();
      if (existing) {
        throw new ConvexError("SKU already exists.");
      }
    }

    const productId = await ctx.db.insert("products", {
      salonId: args.salonId,
      name: validateRequiredString("Product name", args.name, 2),
      brand: sanitizeOptionalText(args.brand),
      description: sanitizeOptionalText(args.description),
      category: sanitizeOptionalText(args.category),
      priceDkk: validateMoney("Price", args.priceDkk),
      stockQuantity: validateNonNegativeInteger("Stock quantity", args.stockQuantity),
      sku,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(productId);
  },
});

export const createOpeningHours = mutation({
  args: openingHoursInputValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireRole(ctx, "staff");
    assertSalonAccess(appUser, args.salonId);

    const salon = await ctx.db.get(args.salonId);
    if (!salon) {
      throw new ConvexError("Salon not found.");
    }

    if (args.employeeId) {
      const employee = await ctx.db.get(args.employeeId);
      if (!employee || employee.salonId !== args.salonId) {
        throw new ConvexError("Employee does not belong to the salon.");
      }
    }

    const opensAt = validateTimeString("Opening time", args.opensAt);
    const closesAt = validateTimeString("Closing time", args.closesAt);
    if (!args.isClosed && opensAt >= closesAt) {
      throw new ConvexError("Opening time must be before closing time.");
    }
    if (
      args.validFrom !== undefined &&
      args.validTo !== undefined &&
      args.validFrom > args.validTo
    ) {
      throw new ConvexError("validFrom must be before validTo.");
    }

    const openingHoursId = await ctx.db.insert("openingHours", {
      salonId: args.salonId,
      employeeId: args.employeeId,
      dayOfWeek: args.dayOfWeek,
      opensAt,
      closesAt,
      isClosed: args.isClosed,
      validFrom: args.validFrom,
      validTo: args.validTo,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(openingHoursId);
  },
});

export const assignUserRole = mutation({
  args: {
    appUserId: v.id("appUsers"),
    role: userRoleValidator,
    salonId: v.optional(v.id("salons")),
    employeeId: v.optional(v.id("employees")),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const appUser = await ctx.db.get(args.appUserId);
    if (!appUser) {
      throw new ConvexError("App user not found.");
    }

    if (args.employeeId) {
      const employee = await ctx.db.get(args.employeeId);
      if (!employee) {
        throw new ConvexError("Employee not found.");
      }
      if (args.salonId && employee.salonId !== args.salonId) {
        throw new ConvexError("Employee salon does not match the selected salon.");
      }
    }

    await ctx.db.patch(args.appUserId, {
      role: args.role,
      salonId: args.salonId,
      employeeId: args.employeeId,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.appUserId);
  },
});
