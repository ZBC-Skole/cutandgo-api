import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const nullableString = v.optional(v.union(v.null(), v.string()));
const nullableNumber = v.optional(v.union(v.null(), v.number()));
const optionalString = v.optional(v.string());
const optionalNumber = v.optional(v.number());

export default defineSchema({
  user: defineTable({
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: nullableString,
    createdAt: v.number(),
    updatedAt: v.number(),
    twoFactorEnabled: v.optional(v.union(v.null(), v.boolean())),
    isAnonymous: v.optional(v.union(v.null(), v.boolean())),
    username: nullableString,
    displayUsername: nullableString,
    phoneNumber: nullableString,
    phoneNumberVerified: v.optional(v.union(v.null(), v.boolean())),
    userId: nullableString,
    role: nullableString,
    banned: v.optional(v.boolean()),
    banReason: nullableString,
    banExpires: nullableNumber,
  })
    .index("email_name", ["email", "name"])
    .index("name", ["name"])
    .index("userId", ["userId"])
    .index("username", ["username"])
    .index("phoneNumber", ["phoneNumber"])
    .index("role", ["role"]),
  session: defineTable({
    expiresAt: v.number(),
    token: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    ipAddress: nullableString,
    userAgent: nullableString,
    userId: v.string(),
    impersonatedBy: nullableString,
    activeOrganizationId: nullableString,
    activeTeamId: nullableString,
  })
    .index("expiresAt", ["expiresAt"])
    .index("expiresAt_userId", ["expiresAt", "userId"])
    .index("token", ["token"])
    .index("userId", ["userId"])
    .index("activeOrganizationId", ["activeOrganizationId"]),
  account: defineTable({
    accountId: v.string(),
    providerId: v.string(),
    userId: v.string(),
    accessToken: nullableString,
    refreshToken: nullableString,
    idToken: nullableString,
    accessTokenExpiresAt: nullableNumber,
    refreshTokenExpiresAt: nullableNumber,
    scope: nullableString,
    password: nullableString,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("accountId", ["accountId"])
    .index("accountId_providerId", ["accountId", "providerId"])
    .index("providerId_userId", ["providerId", "userId"])
    .index("userId", ["userId"]),
  verification: defineTable({
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("expiresAt", ["expiresAt"])
    .index("identifier", ["identifier"]),
  twoFactor: defineTable({
    secret: v.string(),
    backupCodes: v.string(),
    userId: v.string(),
  }).index("userId", ["userId"]),
  oauthApplication: defineTable({
    name: nullableString,
    icon: nullableString,
    metadata: nullableString,
    clientId: nullableString,
    clientSecret: nullableString,
    redirectUrls: nullableString,
    type: nullableString,
    disabled: v.optional(v.union(v.null(), v.boolean())),
    userId: nullableString,
    createdAt: nullableNumber,
    updatedAt: nullableNumber,
  })
    .index("clientId", ["clientId"])
    .index("userId", ["userId"]),
  oauthAccessToken: defineTable({
    accessToken: nullableString,
    refreshToken: nullableString,
    accessTokenExpiresAt: nullableNumber,
    refreshTokenExpiresAt: nullableNumber,
    clientId: nullableString,
    userId: nullableString,
    scopes: nullableString,
    createdAt: nullableNumber,
    updatedAt: nullableNumber,
  })
    .index("accessToken", ["accessToken"])
    .index("refreshToken", ["refreshToken"])
    .index("clientId", ["clientId"])
    .index("userId", ["userId"]),
  oauthConsent: defineTable({
    clientId: nullableString,
    userId: nullableString,
    scopes: nullableString,
    createdAt: nullableNumber,
    updatedAt: nullableNumber,
    consentGiven: v.optional(v.union(v.null(), v.boolean())),
  })
    .index("clientId_userId", ["clientId", "userId"])
    .index("userId", ["userId"]),
  jwks: defineTable({
    publicKey: v.string(),
    privateKey: v.string(),
    createdAt: v.number(),
    expiresAt: nullableNumber,
  }),
  rateLimit: defineTable({
    key: v.string(),
    count: v.number(),
    lastRequest: v.number(),
  }).index("key", ["key"]),
  organization: defineTable({
    name: v.string(),
    slug: v.string(),
    logo: nullableString,
    metadata: nullableString,
    createdAt: v.number(),
    updatedAt: nullableNumber,
  })
    .index("slug", ["slug"])
    .index("name", ["name"]),
  member: defineTable({
    organizationId: v.string(),
    userId: v.string(),
    role: v.string(),
    createdAt: v.number(),
    updatedAt: nullableNumber,
  })
    .index("organizationId", ["organizationId"])
    .index("userId", ["userId"])
    .index("organizationId_userId", ["organizationId", "userId"]),
  invitation: defineTable({
    email: nullableString,
    role: nullableString,
    status: nullableString,
    organizationId: nullableString,
    teamId: nullableString,
    inviterId: nullableString,
    expiresAt: nullableNumber,
    createdAt: nullableNumber,
    updatedAt: nullableNumber,
  })
    .index("organizationId", ["organizationId"])
    .index("email", ["email"]),
  appUser: defineTable({
    authUserId: v.string(),
    email: v.string(),
    fullName: v.string(),
    phone: optionalString,
    role: v.union(
      v.literal("client"),
      v.literal("staff"),
      v.literal("admin"),
    ),
    salonId: optionalString,
    employeeId: optionalString,
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("authUserId", ["authUserId"])
    .index("email", ["email"])
    .index("salonId", ["salonId"])
    .index("employeeId", ["employeeId"]),
  salon: defineTable({
    organizationId: optionalString,
    name: v.string(),
    slug: v.string(),
    description: optionalString,
    phone: v.string(),
    email: v.string(),
    addressLine1: v.string(),
    addressLine2: optionalString,
    postalCode: v.string(),
    city: v.string(),
    country: v.string(),
    timezone: v.string(),
    latitude: optionalNumber,
    longitude: optionalNumber,
    ownerAuthUserId: optionalString,
    ownerAppUserId: optionalString,
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("slug", ["slug"])
    .index("organizationId", ["organizationId"])
    .index("ownerAuthUserId", ["ownerAuthUserId"]),
  employee: defineTable({
    salonId: v.string(),
    userId: optionalString,
    personalId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    displayName: v.string(),
    role: v.union(v.literal("staff"), v.literal("manager")),
    email: optionalString,
    phone: optionalString,
    bio: optionalString,
    workerPinHash: v.string(),
    authLoginKey: optionalString,
    isAvailable: v.boolean(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("salonId", ["salonId"])
    .index("userId", ["userId"])
    .index("personalId", ["personalId"])
    .index("email", ["email"]),
  service: defineTable({
    salonId: v.string(),
    name: v.string(),
    description: optionalString,
    durationMinutes: v.number(),
    priceDkk: v.number(),
    category: optionalString,
    employeeIds: v.array(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("salonId", ["salonId"]),
  product: defineTable({
    salonId: v.string(),
    name: v.string(),
    brand: optionalString,
    description: optionalString,
    category: optionalString,
    priceDkk: v.number(),
    stockQuantity: v.number(),
    sku: optionalString,
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("salonId", ["salonId"]),
  openingHours: defineTable({
    salonId: v.string(),
    employeeId: optionalString,
    dayOfWeek: v.union(
      v.literal(0),
      v.literal(1),
      v.literal(2),
      v.literal(3),
      v.literal(4),
      v.literal(5),
      v.literal(6),
    ),
    opensAt: v.string(),
    closesAt: v.string(),
    isClosed: v.boolean(),
    validFrom: optionalNumber,
    validTo: optionalNumber,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("salonId", ["salonId"])
    .index("employeeId", ["employeeId"]),
  booking: defineTable({
    salonId: v.string(),
    clientUserId: optionalString,
    employeeId: v.string(),
    serviceId: v.string(),
    createdByUserId: optionalString,
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("no_show"),
    ),
    startsAt: v.number(),
    endsAt: v.number(),
    notes: optionalString,
    customerName: v.string(),
    customerEmail: v.string(),
    customerPhone: v.string(),
    cancellationReason: optionalString,
    cancelledAt: optionalNumber,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("salonId", ["salonId"])
    .index("employeeId", ["employeeId"])
    .index("clientUserId", ["clientUserId"])
    .index("startsAt", ["startsAt"])
    .index("status", ["status"])
    .index("employeeId_startsAt", ["employeeId", "startsAt"]),
});
