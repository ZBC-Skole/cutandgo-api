import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
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
  validateLatitude,
  validateLongitude,
  validateMoney,
  validateNonNegativeInteger,
  validatePersonalId,
  validatePhone,
  validatePositiveInteger,
  validateRequiredString,
  validateSlug,
  validateTimeString,
} from "./domain";
import { authComponent } from "./auth";
import { assertSalonAccess, requireRole, requireViewer } from "./authz";
import {
  SLOT_INTERVAL_MINUTES,
  addDaysToLocalDate,
  getEndOfLocalDayTimestamp,
  getStartOfLocalDayTimestamp,
  getZonedDateParts,
  haversineDistanceKm,
  localDateTimeToUtcTimestamp,
  overlaps,
  parseTimeStringToMinutes,
} from "./scheduling";

const blockingStatuses = new Set(["pending", "confirmed", "completed"]);
const bookableStatuses = new Set(["pending", "confirmed"]);
const MAX_AVAILABILITY_DAYS = 14;
const LOOKBACK_WINDOW_MS = 24 * 60 * 60 * 1000;

type BookingDoc = Doc<"bookings">;
type OpeningHoursDoc = Doc<"openingHours">;
type EmployeeDoc = Doc<"employees">;
type ServiceDoc = Doc<"services">;
type DbCtx = QueryCtx | MutationCtx;

function generatePersonalId(firstName: string, lastName: string) {
  const base = `${firstName.slice(0, 2)}${lastName.slice(0, 2)}`
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .padEnd(4, "X");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${base}-${suffix}`;
}

async function ensureUniquePersonalId(
  ctx: DbCtx,
  personalId: string,
  currentEmployeeId?: Id<"employees">,
) {
  const existing = await ctx.db
    .query("employees")
    .withIndex("personalId", (query) => query.eq("personalId", personalId))
    .unique();

  if (existing && existing._id !== currentEmployeeId) {
    throw new ConvexError("Personal ID already exists.");
  }
}

function isOpeningHoursActiveForDay(openingHours: OpeningHoursDoc, dayStart: number) {
  if (openingHours.validFrom !== undefined && dayStart < openingHours.validFrom) {
    return false;
  }
  if (openingHours.validTo !== undefined && dayStart > openingHours.validTo) {
    return false;
  }
  return true;
}

function pickOpeningHoursForDay(
  entries: OpeningHoursDoc[],
  dayOfWeek: number,
  dayStart: number,
) {
  const matchingEntries = entries
    .filter(
      (entry) =>
        entry.dayOfWeek === dayOfWeek && isOpeningHoursActiveForDay(entry, dayStart),
    )
    .sort((left, right) => (right.validFrom ?? 0) - (left.validFrom ?? 0));

  return matchingEntries[0] ?? null;
}

async function getApplicableOpeningHours(
  ctx: DbCtx,
  salonId: Id<"salons">,
  employeeId: Id<"employees">,
  dayOfWeek: number,
  dayStart: number,
) {
  const [employeeHours, salonHours] = await Promise.all([
    ctx.db
      .query("openingHours")
      .withIndex("employeeId_dayOfWeek", (query) =>
        query.eq("employeeId", employeeId).eq("dayOfWeek", dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6),
      )
      .collect(),
    ctx.db
      .query("openingHours")
      .withIndex("salonId_dayOfWeek", (query) =>
        query.eq("salonId", salonId).eq("dayOfWeek", dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6),
      )
      .collect(),
  ]);

  return (
    pickOpeningHoursForDay(employeeHours, dayOfWeek, dayStart) ??
    pickOpeningHoursForDay(salonHours.filter((entry) => !entry.employeeId), dayOfWeek, dayStart)
  );
}

async function getBlockingBookingsForEmployee(
  ctx: DbCtx,
  employeeId: Id<"employees">,
  startsAt: number,
  endsAt: number,
  excludeBookingId?: Id<"bookings">,
) {
  const bookings = await ctx.db
    .query("bookings")
    .withIndex("employeeId_startsAt", (query) =>
      query.eq("employeeId", employeeId).gte("startsAt", startsAt - LOOKBACK_WINDOW_MS),
    )
    .filter((query) => query.lt(query.field("startsAt"), endsAt))
    .collect();

  return bookings.filter(
    (booking) =>
      booking._id !== excludeBookingId &&
      blockingStatuses.has(booking.status) &&
      overlaps(booking, { startsAt, endsAt }),
  );
}

async function assertBookingSlotIsAvailable(
  ctx: DbCtx,
  salon: Doc<"salons">,
  employee: EmployeeDoc,
  startsAt: number,
  endsAt: number,
  excludeBookingId?: Id<"bookings">,
) {
  const dayStart = getStartOfLocalDayTimestamp(startsAt, salon.timezone);
  const localDay = getZonedDateParts(startsAt, salon.timezone);
  const openingHours = await getApplicableOpeningHours(
    ctx,
    salon._id,
    employee._id,
    localDay.weekday,
    dayStart,
  );

  if (!openingHours || openingHours.isClosed) {
    throw new ConvexError("Selected time is outside opening hours.");
  }

  const opensAtMinutes = parseTimeStringToMinutes(openingHours.opensAt);
  const closesAtMinutes = parseTimeStringToMinutes(openingHours.closesAt);
  const openingStart = localDateTimeToUtcTimestamp(
    salon.timezone,
    localDay.year,
    localDay.month,
    localDay.day,
    Math.floor(opensAtMinutes / 60),
    opensAtMinutes % 60,
  );
  const openingEnd = localDateTimeToUtcTimestamp(
    salon.timezone,
    localDay.year,
    localDay.month,
    localDay.day,
    Math.floor(closesAtMinutes / 60),
    closesAtMinutes % 60,
  );

  if (startsAt < openingStart || endsAt > openingEnd) {
    throw new ConvexError("Selected time is outside opening hours.");
  }

  const overlappingBookings = await getBlockingBookingsForEmployee(
    ctx,
    employee._id,
    startsAt,
    endsAt,
    excludeBookingId,
  );
  if (overlappingBookings.length > 0) {
    throw new ConvexError("Selected time is no longer available.");
  }
}

async function getBookingExpanded(ctx: DbCtx, booking: BookingDoc) {
  const [salon, employee, service, client] = await Promise.all([
    ctx.db.get(booking.salonId),
    ctx.db.get(booking.employeeId),
    ctx.db.get(booking.serviceId),
    ctx.db.get(booking.clientUserId),
  ]);

  return {
    ...booking,
    salon,
    employee,
    service,
    client,
  };
}

async function verifyStaffAccessByPersonalId(
  ctx: DbCtx,
  employeeId: Id<"employees">,
  personalId: string,
) {
  const employee = await ctx.db.get(employeeId);
  if (!employee || !employee.isActive) {
    throw new ConvexError("Employee not found.");
  }

  if (!employee.personalId || employee.personalId !== validatePersonalId(personalId)) {
    throw new ConvexError("Invalid personal ID.");
  }

  return employee;
}

function buildAvailabilitySlots(
  employee: EmployeeDoc,
  service: ServiceDoc,
  bookings: BookingDoc[],
  windowStart: number,
  windowEnd: number,
) {
  const slots: Array<{
    employeeId: Id<"employees">;
    serviceId: Id<"services">;
    startsAt: number;
    endsAt: number;
  }> = [];
  const serviceDurationMs = service.durationMinutes * 60_000;
  const slotStepMs = SLOT_INTERVAL_MINUTES * 60_000;

  for (
    let startsAt = windowStart;
    startsAt + serviceDurationMs <= windowEnd;
    startsAt += slotStepMs
  ) {
    const endsAt = startsAt + serviceDurationMs;
    const hasOverlap = bookings.some(
      (booking) =>
        blockingStatuses.has(booking.status) && overlaps(booking, { startsAt, endsAt }),
    );

    if (!hasOverlap) {
      slots.push({
        employeeId: employee._id,
        serviceId: service._id,
        startsAt,
        endsAt,
      });
    }
  }

  return slots;
}

async function getSalonBookingsInRange(
  ctx: DbCtx,
  salonId: Id<"salons">,
  startsAt: number,
  endsAt: number,
) {
  const bookings = await ctx.db
    .query("bookings")
    .withIndex("salonId_startsAt", (query) =>
      query.eq("salonId", salonId).gte("startsAt", startsAt),
    )
    .filter((query) => query.lt(query.field("startsAt"), endsAt))
    .collect();

  return bookings.filter((booking) => booking.startsAt < endsAt);
}

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
    const salons = await ctx.db
      .query("salons")
      .withIndex("isActive", (query) => query.eq("isActive", true))
      .collect();

    return salons.sort((left, right) => left.name.localeCompare(right.name));
  },
});

export const findNearestSalon = query({
  args: {
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    const latitude = validateLatitude(args.latitude);
    const longitude = validateLongitude(args.longitude);
    const salons = await ctx.db
      .query("salons")
      .withIndex("isActive", (query) => query.eq("isActive", true))
      .collect();

    const candidates = salons
      .filter(
        (salon) =>
          salon.latitude !== undefined && salon.longitude !== undefined && salon.isActive,
      )
      .map((salon) => ({
        salon,
        distanceKm: haversineDistanceKm(
          latitude,
          longitude,
          salon.latitude!,
          salon.longitude!,
        ),
      }))
      .sort((left, right) => left.distanceKm - right.distanceKm);

    if (candidates.length === 0) {
      throw new ConvexError("No salons with location data found.");
    }

    return {
      nearestSalon: candidates[0].salon,
      distanceKm: Number(candidates[0].distanceKm.toFixed(2)),
      candidates,
    };
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

export const listSalonEmployees = query({
  args: {
    salonId: v.id("salons"),
  },
  handler: async (ctx, args) => {
    const salon = await ctx.db.get(args.salonId);
    if (!salon || !salon.isActive) {
      throw new ConvexError("Salon not found.");
    }

    return await ctx.db
      .query("employees")
      .withIndex("salonId_isActive", (query) =>
        query.eq("salonId", args.salonId).eq("isActive", true),
      )
      .collect();
  },
});

export const listSalonServices = query({
  args: {
    salonId: v.id("salons"),
    employeeId: v.optional(v.id("employees")),
  },
  handler: async (ctx, args) => {
    const salon = await ctx.db.get(args.salonId);
    if (!salon || !salon.isActive) {
      throw new ConvexError("Salon not found.");
    }

    if (args.employeeId) {
      const employee = await ctx.db.get(args.employeeId);
      if (!employee || employee.salonId !== args.salonId || !employee.isActive) {
        throw new ConvexError("Employee not found.");
      }
    }

    const services = await ctx.db
      .query("services")
      .withIndex("salonId_isActive", (query) =>
        query.eq("salonId", args.salonId).eq("isActive", true),
      )
      .collect();

    return args.employeeId
      ? services.filter((service) => service.employeeIds.includes(args.employeeId!))
      : services;
  },
});

export const getAvailableTimeSlots = query({
  args: {
    salonId: v.id("salons"),
    employeeId: v.id("employees"),
    serviceId: v.id("services"),
    startsAt: v.number(),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const requestedDays = args.days ?? 1;
    if (!Number.isInteger(requestedDays) || requestedDays <= 0) {
      throw new ConvexError("Days must be a positive integer.");
    }
    if (requestedDays > MAX_AVAILABILITY_DAYS) {
      throw new ConvexError(`Days cannot exceed ${MAX_AVAILABILITY_DAYS}.`);
    }

    const [salon, employee, service] = await Promise.all([
      ctx.db.get(args.salonId),
      ctx.db.get(args.employeeId),
      ctx.db.get(args.serviceId),
    ]);

    if (!salon || !salon.isActive) {
      throw new ConvexError("Salon not found.");
    }
    if (!employee || employee.salonId !== args.salonId || !employee.isActive) {
      throw new ConvexError("Employee not found.");
    }
    if (!service || service.salonId !== args.salonId || !service.isActive) {
      throw new ConvexError("Service not found.");
    }
    if (!service.employeeIds.includes(employee._id)) {
      throw new ConvexError("Employee is not assigned to the selected service.");
    }

    const availability: Array<{
      date: string;
      slots: Array<{
        employeeId: Id<"employees">;
        serviceId: Id<"services">;
        startsAt: number;
        endsAt: number;
      }>;
    }> = [];
    const startOfFirstDay = getStartOfLocalDayTimestamp(args.startsAt, salon.timezone);
    const firstLocalDay = getZonedDateParts(startOfFirstDay, salon.timezone);

    for (let dayOffset = 0; dayOffset < requestedDays; dayOffset += 1) {
      const localDate = addDaysToLocalDate(
        firstLocalDay.year,
        firstLocalDay.month,
        firstLocalDay.day,
        dayOffset,
      );
      const dayStart = localDateTimeToUtcTimestamp(
        salon.timezone,
        localDate.year,
        localDate.month,
        localDate.day,
        0,
        0,
      );
      const dayEnd = getEndOfLocalDayTimestamp(dayStart, salon.timezone);
      const dayParts = getZonedDateParts(dayStart, salon.timezone);
      const openingHours = await getApplicableOpeningHours(
        ctx,
        salon._id,
        employee._id,
        dayParts.weekday,
        dayStart,
      );

      if (!openingHours || openingHours.isClosed) {
        availability.push({
          date: `${localDate.year}-${String(localDate.month).padStart(2, "0")}-${String(
            localDate.day,
          ).padStart(2, "0")}`,
          slots: [],
        });
        continue;
      }

      const opensAtMinutes = parseTimeStringToMinutes(openingHours.opensAt);
      const closesAtMinutes = parseTimeStringToMinutes(openingHours.closesAt);
      const windowStart = Math.max(
        localDateTimeToUtcTimestamp(
          salon.timezone,
          localDate.year,
          localDate.month,
          localDate.day,
          Math.floor(opensAtMinutes / 60),
          opensAtMinutes % 60,
        ),
        args.startsAt,
      );
      const windowEnd = localDateTimeToUtcTimestamp(
        salon.timezone,
        localDate.year,
        localDate.month,
        localDate.day,
        Math.floor(closesAtMinutes / 60),
        closesAtMinutes % 60,
      );
      const bookings = await getBlockingBookingsForEmployee(
        ctx,
        employee._id,
        windowStart,
        windowEnd,
      );

      availability.push({
        date: `${localDate.year}-${String(localDate.month).padStart(2, "0")}-${String(
          localDate.day,
        ).padStart(2, "0")}`,
        slots: buildAvailabilitySlots(employee, service, bookings, windowStart, windowEnd),
      });
    }

    return {
      salon,
      employee,
      service,
      availability,
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
      latitude: args.latitude === undefined ? undefined : validateLatitude(args.latitude),
      longitude:
        args.longitude === undefined ? undefined : validateLongitude(args.longitude),
      ownerUserId: appUser._id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(salonId);
  },
});

export const updateSalonLocation = mutation({
  args: {
    salonId: v.id("salons"),
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    const { appUser } = await requireRole(ctx, "staff");
    assertSalonAccess(appUser, args.salonId);

    const salon = await ctx.db.get(args.salonId);
    if (!salon) {
      throw new ConvexError("Salon not found.");
    }

    await ctx.db.patch(args.salonId, {
      latitude: validateLatitude(args.latitude),
      longitude: validateLongitude(args.longitude),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.salonId);
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

    const firstName = validateRequiredString("First name", args.firstName, 2);
    const lastName = validateRequiredString("Last name", args.lastName, 2);
    const personalId = validatePersonalId(
      args.personalId ?? generatePersonalId(firstName, lastName),
    );
    await ensureUniquePersonalId(ctx, personalId);

    const now = Date.now();
    const employeeId = await ctx.db.insert("employees", {
      salonId: args.salonId,
      firstName,
      lastName,
      displayName: validateRequiredString("Display name", args.displayName, 2),
      role: args.role,
      email: args.email ? validateEmail(args.email) : undefined,
      phone: args.phone ? validatePhone(args.phone) : undefined,
      bio: sanitizeOptionalText(args.bio),
      personalId,
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

    const [salon, employee, service] = await Promise.all([
      ctx.db.get(args.salonId),
      ctx.db.get(args.employeeId),
      ctx.db.get(args.serviceId),
    ]);

    if (!salon) {
      throw new ConvexError("Salon not found.");
    }
    if (!employee || employee.salonId !== args.salonId || !employee.isActive) {
      throw new ConvexError("Employee does not belong to the salon.");
    }
    if (!service || service.salonId !== args.salonId || !service.isActive) {
      throw new ConvexError("Service does not belong to the salon.");
    }
    if (!service.employeeIds.includes(args.employeeId)) {
      throw new ConvexError("Employee is not assigned to the selected service.");
    }

    const expectedEndsAt = args.startsAt + service.durationMinutes * 60_000;
    const endsAt = args.endsAt ?? expectedEndsAt;
    validateDateRange(args.startsAt, endsAt);

    if (args.endsAt !== undefined && args.endsAt !== expectedEndsAt) {
      throw new ConvexError("Selected time must match the service duration exactly.");
    }

    await assertBookingSlotIsAvailable(ctx, salon, employee, args.startsAt, endsAt);

    const now = Date.now();
    const bookingId = await ctx.db.insert("bookings", {
      salonId: args.salonId,
      clientUserId: appUser._id,
      employeeId: args.employeeId,
      serviceId: args.serviceId,
      createdByUserId: appUser._id,
      status: "confirmed",
      startsAt: args.startsAt,
      endsAt,
      notes: sanitizeOptionalText(args.notes),
      customerName: validateRequiredString("Customer name", args.customerName, 2),
      customerEmail: validateEmail(args.customerEmail),
      customerPhone: validatePhone(args.customerPhone),
      createdAt: now,
      updatedAt: now,
    });

    return await getBookingExpanded(ctx, (await ctx.db.get(bookingId)) as BookingDoc);
  },
});

export const cancelBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { appUser } = await requireViewer(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError("Booking not found.");
    }

    const canManageBooking =
      appUser.role === "admin" ||
      booking.clientUserId === appUser._id ||
      appUser.salonId === booking.salonId;

    if (!canManageBooking) {
      throw new ConvexError("Insufficient permissions.");
    }

    if (!bookableStatuses.has(booking.status)) {
      throw new ConvexError("Booking cannot be cancelled in its current state.");
    }

    await ctx.db.patch(args.bookingId, {
      status: "cancelled",
      cancellationReason: sanitizeOptionalText(args.reason),
      cancelledAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await getBookingExpanded(ctx, (await ctx.db.get(args.bookingId)) as BookingDoc);
  },
});

export const getBookingConfirmation = query({
  args: {
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    const { appUser } = await requireViewer(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError("Booking not found.");
    }

    const hasAccess =
      appUser.role === "admin" ||
      booking.clientUserId === appUser._id ||
      appUser.salonId === booking.salonId;
    if (!hasAccess) {
      throw new ConvexError("Insufficient permissions.");
    }

    const expandedBooking = await getBookingExpanded(ctx, booking);
    return {
      booking: expandedBooking,
      confirmation: {
        bookingId: booking._id,
        status: booking.status,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
      },
    };
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

    return await getBookingExpanded(ctx, (await ctx.db.get(args.bookingId)) as BookingDoc);
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

export const updateOpeningHours = mutation({
  args: {
    openingHoursId: v.id("openingHours"),
    opensAt: v.optional(v.string()),
    closesAt: v.optional(v.string()),
    isClosed: v.optional(v.boolean()),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { appUser } = await requireRole(ctx, "staff");
    const current = await ctx.db.get(args.openingHoursId);
    if (!current) {
      throw new ConvexError("Opening hours not found.");
    }

    assertSalonAccess(appUser, current.salonId);

    const opensAt =
      args.opensAt === undefined ? current.opensAt : validateTimeString("Opening time", args.opensAt);
    const closesAt =
      args.closesAt === undefined ? current.closesAt : validateTimeString("Closing time", args.closesAt);
    const isClosed = args.isClosed ?? current.isClosed;
    const validFrom = args.validFrom ?? current.validFrom;
    const validTo = args.validTo ?? current.validTo;

    if (!isClosed && opensAt >= closesAt) {
      throw new ConvexError("Opening time must be before closing time.");
    }
    if (validFrom !== undefined && validTo !== undefined && validFrom > validTo) {
      throw new ConvexError("validFrom must be before validTo.");
    }

    await ctx.db.patch(args.openingHoursId, {
      opensAt,
      closesAt,
      isClosed,
      validFrom,
      validTo,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.openingHoursId);
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

export const getSalonAnalytics = query({
  args: {
    salonId: v.id("salons"),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { appUser } = await requireRole(ctx, "staff");
    assertSalonAccess(appUser, args.salonId);

    const salon = await ctx.db.get(args.salonId);
    if (!salon) {
      throw new ConvexError("Salon not found.");
    }

    const startsAt = args.startsAt ?? Date.now() - 30 * 24 * 60 * 60 * 1000;
    const endsAt = args.endsAt ?? Date.now();
    validateDateRange(startsAt, endsAt);

    const bookings = await getSalonBookingsInRange(ctx, args.salonId, startsAt, endsAt);
    const services = await ctx.db
      .query("services")
      .withIndex("salonId", (query) => query.eq("salonId", args.salonId))
      .collect();
    const serviceById = new Map(services.map((service) => [service._id, service]));

    const totalBookings = bookings.length;
    const cancelledBookings = bookings.filter((booking) => booking.status === "cancelled").length;
    const completedBookings = bookings.filter((booking) => booking.status === "completed").length;
    const confirmedBookings = bookings.filter((booking) => booking.status === "confirmed").length;
    const revenueDkk = bookings
      .filter((booking) => booking.status === "completed")
      .reduce((sum, booking) => sum + (serviceById.get(booking.serviceId)?.priceDkk ?? 0), 0);
    const serviceBreakdown = services
      .map((service) => ({
        serviceId: service._id,
        name: service.name,
        bookings: bookings.filter((booking) => booking.serviceId === service._id).length,
      }))
      .filter((entry) => entry.bookings > 0)
      .sort((left, right) => right.bookings - left.bookings);

    return {
      salon,
      range: { startsAt, endsAt },
      totals: {
        totalBookings,
        cancelledBookings,
        completedBookings,
        confirmedBookings,
        revenueDkk,
      },
      serviceBreakdown,
    };
  },
});

export const getPlatformAnalytics = query({
  args: {
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    const startsAt = args.startsAt ?? Date.now() - 30 * 24 * 60 * 60 * 1000;
    const endsAt = args.endsAt ?? Date.now();
    validateDateRange(startsAt, endsAt);

    const salons = await ctx.db.query("salons").collect();
    const bookings = await Promise.all(
      salons.map((salon) => getSalonBookingsInRange(ctx, salon._id, startsAt, endsAt)),
    );

    return {
      range: { startsAt, endsAt },
      totals: {
        salons: salons.length,
        bookings: bookings.flat().length,
        activeSalons: salons.filter((salon) => salon.isActive).length,
      },
      salons: await Promise.all(
        salons.map(async (salon) => ({
          salon,
          bookings: (await getSalonBookingsInRange(ctx, salon._id, startsAt, endsAt)).length,
        })),
      ),
    };
  },
});

export const staffLoginWithPersonalId = query({
  args: {
    personalId: v.string(),
  },
  handler: async (ctx, args) => {
    const personalId = validatePersonalId(args.personalId);
    const employee = await ctx.db
      .query("employees")
      .withIndex("personalId", (query) => query.eq("personalId", personalId))
      .unique();

    if (!employee || !employee.isActive) {
      throw new ConvexError("Invalid personal ID.");
    }

    const salon = await ctx.db.get(employee.salonId);
    return {
      authenticated: true,
      employee,
      salon,
    };
  },
});

export const getEmployeeNextCustomer = query({
  args: {
    employeeId: v.id("employees"),
    personalId: v.string(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const employee = await verifyStaffAccessByPersonalId(ctx, args.employeeId, args.personalId);
    const now = args.now ?? Date.now();
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("employeeId_startsAt", (query) =>
        query.eq("employeeId", employee._id).gte("startsAt", now),
      )
      .collect();

    const nextBooking = bookings
      .filter((booking) => bookableStatuses.has(booking.status))
      .sort((left, right) => left.startsAt - right.startsAt)[0];

    if (!nextBooking) {
      return {
        employee,
        nextBooking: null,
      };
    }

    return {
      employee,
      nextBooking: await getBookingExpanded(ctx, nextBooking),
    };
  },
});

export const getEmployeeBookings = query({
  args: {
    employeeId: v.id("employees"),
    personalId: v.string(),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const employee = await verifyStaffAccessByPersonalId(ctx, args.employeeId, args.personalId);
    const startsAt = args.startsAt ?? Date.now() - LOOKBACK_WINDOW_MS;
    const endsAt = args.endsAt ?? Date.now() + 14 * LOOKBACK_WINDOW_MS;
    validateDateRange(startsAt, endsAt);

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("employeeId_startsAt", (query) =>
        query.eq("employeeId", employee._id).gte("startsAt", startsAt),
      )
      .filter((query) => query.lt(query.field("startsAt"), endsAt))
      .collect();

    return {
      employee,
      bookings: await Promise.all(
        bookings
          .filter((booking) => booking.startsAt < endsAt)
          .sort((left, right) => left.startsAt - right.startsAt)
          .map((booking) => getBookingExpanded(ctx, booking)),
      ),
    };
  },
});

export const getBookingDetailsForStaff = query({
  args: {
    bookingId: v.id("bookings"),
    personalId: v.string(),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new ConvexError("Booking not found.");
    }

    await verifyStaffAccessByPersonalId(ctx, booking.employeeId, args.personalId);
    return await getBookingExpanded(ctx, booking);
  },
});

export const cancelEmployeeBookingsForSickness = mutation({
  args: {
    employeeId: v.id("employees"),
    personalId: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const employee = await verifyStaffAccessByPersonalId(ctx, args.employeeId, args.personalId);
    validateDateRange(args.startsAt, args.endsAt);

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("employeeId_startsAt", (query) =>
        query.eq("employeeId", employee._id).gte("startsAt", args.startsAt),
      )
      .filter((query) => query.lt(query.field("startsAt"), args.endsAt))
      .collect();

    const affectedBookings = bookings.filter(
      (booking) => booking.startsAt < args.endsAt && bookableStatuses.has(booking.status),
    );

    const cancellationReason =
      sanitizeOptionalText(args.reason) ?? "Cancelled due to staff sickness.";

    await Promise.all(
      affectedBookings.map((booking) =>
        ctx.db.patch(booking._id, {
          status: "cancelled",
          cancellationReason,
          cancelledAt: Date.now(),
          updatedAt: Date.now(),
        }),
      ),
    );

    return {
      employee,
      cancelledCount: affectedBookings.length,
      bookings: await Promise.all(
        affectedBookings.map(async (booking) =>
          getBookingExpanded(ctx, (await ctx.db.get(booking._id)) as BookingDoc),
        ),
      ),
    };
  },
});
