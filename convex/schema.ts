import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  bookingStatusValidator,
  employeeRoleValidator,
  userRoleValidator,
  weekdayValidator,
} from "./domain";

export default defineSchema({
  appUsers: defineTable({
    authUserId: v.string(),
    email: v.string(),
    fullName: v.string(),
    phone: v.optional(v.string()),
    role: userRoleValidator,
    salonId: v.optional(v.id("salons")),
    employeeId: v.optional(v.id("employees")),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("authUserId", ["authUserId"])
    .index("email", ["email"])
    .index("role", ["role"])
    .index("salonId", ["salonId"]),

  salons: defineTable({
    name: v.string(),
    slug: v.string(),
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
    ownerUserId: v.optional(v.id("appUsers")),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("slug", ["slug"])
    .index("ownerUserId", ["ownerUserId"])
    .index("isActive", ["isActive"]),

  employees: defineTable({
    salonId: v.id("salons"),
    userId: v.optional(v.id("appUsers")),
    firstName: v.string(),
    lastName: v.string(),
    displayName: v.string(),
    role: employeeRoleValidator,
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    bio: v.optional(v.string()),
    workerPin: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("salonId", ["salonId"])
    .index("userId", ["userId"])
    .index("salonId_workerPin", ["salonId", "workerPin"])
    .index("salonId_isActive", ["salonId", "isActive"]),

  services: defineTable({
    salonId: v.id("salons"),
    name: v.string(),
    description: v.optional(v.string()),
    durationMinutes: v.number(),
    priceDkk: v.number(),
    category: v.optional(v.string()),
    employeeIds: v.array(v.id("employees")),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("salonId", ["salonId"])
    .index("salonId_isActive", ["salonId", "isActive"]),

  bookings: defineTable({
    salonId: v.id("salons"),
    clientUserId: v.id("appUsers"),
    employeeId: v.id("employees"),
    serviceId: v.id("services"),
    createdByUserId: v.id("appUsers"),
    status: bookingStatusValidator,
    startsAt: v.number(),
    endsAt: v.number(),
    notes: v.optional(v.string()),
    customerName: v.string(),
    customerEmail: v.string(),
    customerPhone: v.string(),
    cancellationReason: v.optional(v.string()),
    cancelledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("salonId", ["salonId"])
    .index("clientUserId", ["clientUserId"])
    .index("employeeId", ["employeeId"])
    .index("serviceId", ["serviceId"])
    .index("salonId_startsAt", ["salonId", "startsAt"])
    .index("employeeId_startsAt", ["employeeId", "startsAt"])
    .index("clientUserId_startsAt", ["clientUserId", "startsAt"]),

  products: defineTable({
    salonId: v.id("salons"),
    name: v.string(),
    brand: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    priceDkk: v.number(),
    stockQuantity: v.number(),
    sku: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("salonId", ["salonId"])
    .index("sku", ["sku"])
    .index("salonId_isActive", ["salonId", "isActive"]),

  openingHours: defineTable({
    salonId: v.id("salons"),
    employeeId: v.optional(v.id("employees")),
    dayOfWeek: weekdayValidator,
    opensAt: v.string(),
    closesAt: v.string(),
    isClosed: v.boolean(),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("salonId", ["salonId"])
    .index("employeeId", ["employeeId"])
    .index("salonId_dayOfWeek", ["salonId", "dayOfWeek"])
    .index("employeeId_dayOfWeek", ["employeeId", "dayOfWeek"]),
});
