import { v } from "convex/values";

export const userRoles = ["client", "staff", "admin"] as const;
export type UserRole = (typeof userRoles)[number];
export const userRoleValidator = v.union(
  v.literal("client"),
  v.literal("staff"),
  v.literal("admin"),
);

export const employeeRoles = ["staff", "admin"] as const;
export type EmployeeRole = (typeof employeeRoles)[number];
export const employeeRoleValidator = v.union(
  v.literal("staff"),
  v.literal("admin"),
);

export const bookingStatuses = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type BookingStatus = (typeof bookingStatuses)[number];
export const bookingStatusValidator = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("no_show"),
);

export const weekdayNumbers = [0, 1, 2, 3, 4, 5, 6] as const;
export const weekdayValidator = v.union(
  v.literal(0),
  v.literal(1),
  v.literal(2),
  v.literal(3),
  v.literal(4),
  v.literal(5),
  v.literal(6),
);

export const timeStringValidator = v.string();
export const slugValidator = v.string();
export const trimmedStringValidator = v.string();

export const salonInputValidator = v.object({
  name: v.string(),
  slug: slugValidator,
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
});

export const employeeInputValidator = v.object({
  salonId: v.id("salons"),
  firstName: v.string(),
  lastName: v.string(),
  displayName: v.string(),
  role: employeeRoleValidator,
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  bio: v.optional(v.string()),
  workerPin: v.optional(v.string()),
});

export const serviceInputValidator = v.object({
  salonId: v.id("salons"),
  name: v.string(),
  description: v.optional(v.string()),
  durationMinutes: v.number(),
  priceDkk: v.number(),
  category: v.optional(v.string()),
  employeeIds: v.array(v.id("employees")),
});

export const bookingInputValidator = v.object({
  salonId: v.id("salons"),
  employeeId: v.id("employees"),
  serviceId: v.id("services"),
  startsAt: v.number(),
  endsAt: v.optional(v.number()),
  notes: v.optional(v.string()),
  customerName: v.string(),
  customerEmail: v.string(),
  customerPhone: v.string(),
});

export const productInputValidator = v.object({
  salonId: v.id("salons"),
  name: v.string(),
  brand: v.optional(v.string()),
  description: v.optional(v.string()),
  category: v.optional(v.string()),
  priceDkk: v.number(),
  stockQuantity: v.number(),
  sku: v.optional(v.string()),
});

export const openingHoursInputValidator = v.object({
  salonId: v.id("salons"),
  dayOfWeek: weekdayValidator,
  opensAt: timeStringValidator,
  closesAt: timeStringValidator,
  isClosed: v.boolean(),
  employeeId: v.optional(v.id("employees")),
  validFrom: v.optional(v.number()),
  validTo: v.optional(v.number()),
});

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+\d][\d\s-]{5,20}$/;

export function normalizeTrimmedString(value: string) {
  return value.trim();
}

export function normalizeSlug(value: string) {
  return normalizeTrimmedString(value).toLowerCase();
}

export function normalizeEmail(value: string) {
  return normalizeTrimmedString(value).toLowerCase();
}

export function normalizePhone(value: string) {
  return normalizeTrimmedString(value);
}

export function sanitizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function validateRequiredString(
  fieldName: string,
  value: string,
  minimumLength = 1,
) {
  const trimmed = normalizeTrimmedString(value);
  if (trimmed.length < minimumLength) {
    throw new Error(`${fieldName} must be at least ${minimumLength} character(s).`);
  }
  return trimmed;
}

export function validateSlug(value: string) {
  const slug = normalizeSlug(value);
  if (!slugPattern.test(slug)) {
    throw new Error("Slug must contain lowercase letters, numbers, and hyphens only.");
  }
  return slug;
}

export function validateEmail(value: string) {
  const email = normalizeEmail(value);
  if (!emailPattern.test(email)) {
    throw new Error("Email must be valid.");
  }
  return email;
}

export function validatePhone(value: string) {
  const phone = normalizePhone(value);
  if (!phonePattern.test(phone)) {
    throw new Error("Phone must be valid.");
  }
  return phone;
}

export function validateMoney(fieldName: string, value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }
  return Math.round(value);
}

export function validatePositiveInteger(fieldName: string, value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return value;
}

export function validateNonNegativeInteger(fieldName: string, value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }
  return value;
}

export function validateTimeString(fieldName: string, value: string) {
  const normalized = normalizeTrimmedString(value);
  if (!timePattern.test(normalized)) {
    throw new Error(`${fieldName} must use HH:MM in 24-hour format.`);
  }
  return normalized;
}

export function validateDateRange(startsAt: number, endsAt: number) {
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt >= endsAt) {
    throw new Error("Start time must be before end time.");
  }
}

export function validateLatitude(value: number) {
  if (!Number.isFinite(value) || value < -90 || value > 90) {
    throw new Error("Latitude must be between -90 and 90.");
  }
  return value;
}

export function validateLongitude(value: number) {
  if (!Number.isFinite(value) || value < -180 || value > 180) {
    throw new Error("Longitude must be between -180 and 180.");
  }
  return value;
}

export function validateWorkerPin(value: string) {
  const normalized = normalizeTrimmedString(value);
  if (!/^\d{4}$/.test(normalized)) {
    throw new Error("Worker PIN must be exactly 4 digits.");
  }
  return normalized;
}
