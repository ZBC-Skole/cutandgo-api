import * as v from "valibot";
import { resolver } from "hono-openapi";

const idSchema = v.string();
const timestampSchema = v.number();

export const authUserSchema = v.object({
  _id: v.string(),
  name: v.string(),
  email: v.string(),
});

export const appUserSchema = v.object({
  _id: idSchema,
  authUserId: v.string(),
  email: v.string(),
  fullName: v.string(),
  phone: v.optional(v.string()),
  role: v.picklist(["client", "staff", "admin"]),
  salonId: v.optional(idSchema),
  employeeId: v.optional(idSchema),
  isActive: v.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const salonSchema = v.object({
  _id: idSchema,
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
  ownerUserId: v.optional(idSchema),
  isActive: v.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const employeeSchema = v.object({
  _id: idSchema,
  salonId: idSchema,
  userId: v.optional(idSchema),
  firstName: v.string(),
  lastName: v.string(),
  displayName: v.string(),
  role: v.picklist(["staff", "admin"]),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  bio: v.optional(v.string()),
  workerPin: v.optional(v.string()),
  isActive: v.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const serviceSchema = v.object({
  _id: idSchema,
  salonId: idSchema,
  name: v.string(),
  description: v.optional(v.string()),
  durationMinutes: v.number(),
  priceDkk: v.number(),
  category: v.optional(v.string()),
  employeeIds: v.array(idSchema),
  isActive: v.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const productSchema = v.object({
  _id: idSchema,
  salonId: idSchema,
  name: v.string(),
  brand: v.optional(v.string()),
  description: v.optional(v.string()),
  category: v.optional(v.string()),
  priceDkk: v.number(),
  stockQuantity: v.number(),
  sku: v.optional(v.string()),
  isActive: v.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const openingHoursSchema = v.object({
  _id: idSchema,
  salonId: idSchema,
  employeeId: v.optional(idSchema),
  dayOfWeek: v.union([
    v.literal(0),
    v.literal(1),
    v.literal(2),
    v.literal(3),
    v.literal(4),
    v.literal(5),
    v.literal(6),
  ]),
  opensAt: v.string(),
  closesAt: v.string(),
  isClosed: v.boolean(),
  validFrom: v.optional(v.number()),
  validTo: v.optional(v.number()),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const bookingSchema = v.object({
  _id: idSchema,
  salonId: idSchema,
  clientUserId: idSchema,
  employeeId: idSchema,
  serviceId: idSchema,
  createdByUserId: idSchema,
  status: v.picklist([
    "pending",
    "confirmed",
    "completed",
    "cancelled",
    "no_show",
  ]),
  startsAt: timestampSchema,
  endsAt: timestampSchema,
  notes: v.optional(v.string()),
  customerName: v.string(),
  customerEmail: v.string(),
  customerPhone: v.string(),
  cancellationReason: v.optional(v.string()),
  cancelledAt: v.optional(v.number()),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const bookingExpandedSchema = v.object({
  _id: idSchema,
  salonId: idSchema,
  clientUserId: idSchema,
  employeeId: idSchema,
  serviceId: idSchema,
  createdByUserId: idSchema,
  status: v.picklist([
    "pending",
    "confirmed",
    "completed",
    "cancelled",
    "no_show",
  ]),
  startsAt: timestampSchema,
  endsAt: timestampSchema,
  notes: v.optional(v.string()),
  customerName: v.string(),
  customerEmail: v.string(),
  customerPhone: v.string(),
  cancellationReason: v.optional(v.string()),
  cancelledAt: v.optional(v.number()),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  salon: v.nullable(salonSchema),
  employee: v.nullable(employeeSchema),
  service: v.nullable(serviceSchema),
  client: v.nullable(appUserSchema),
});

export const viewerContextSchema = v.object({
  authUser: authUserSchema,
  appUser: appUserSchema,
  salon: v.nullable(salonSchema),
  employee: v.nullable(employeeSchema),
});

export const salonFoundationSchema = v.object({
  salon: salonSchema,
  employees: v.array(employeeSchema),
  services: v.array(serviceSchema),
  openingHours: v.array(openingHoursSchema),
  products: v.array(productSchema),
});

export const nearestSalonSchema = v.object({
  nearestSalon: salonSchema,
  distanceKm: v.number(),
  candidates: v.array(
    v.object({
      salon: salonSchema,
      distanceKm: v.number(),
    }),
  ),
});

export const availabilityResponseSchema = v.object({
  salon: salonSchema,
  employee: employeeSchema,
  service: serviceSchema,
  availability: v.array(
    v.object({
      date: v.string(),
      slots: v.array(
        v.object({
          employeeId: idSchema,
          serviceId: idSchema,
          startsAt: timestampSchema,
          endsAt: timestampSchema,
        }),
      ),
    }),
  ),
});

export const bookingConfirmationSchema = v.object({
  booking: bookingExpandedSchema,
  confirmation: v.object({
    bookingId: idSchema,
    status: v.picklist([
      "pending",
      "confirmed",
      "completed",
      "cancelled",
      "no_show",
    ]),
    startsAt: timestampSchema,
    endsAt: timestampSchema,
  }),
});

export const staffLoginSchema = v.object({
  authenticated: v.boolean(),
  employee: employeeSchema,
  salon: v.nullable(salonSchema),
});

export const nextCustomerSchema = v.object({
  employee: employeeSchema,
  nextBooking: v.nullable(bookingExpandedSchema),
});

export const employeeBookingsSchema = v.object({
  employee: employeeSchema,
  bookings: v.array(bookingExpandedSchema),
});

export const sicknessCancellationSchema = v.object({
  employee: employeeSchema,
  cancelledCount: v.number(),
  bookings: v.array(bookingExpandedSchema),
});

export const salonAnalyticsSchema = v.object({
  salon: salonSchema,
  range: v.object({
    startsAt: timestampSchema,
    endsAt: timestampSchema,
  }),
  totals: v.object({
    totalBookings: v.number(),
    cancelledBookings: v.number(),
    completedBookings: v.number(),
    confirmedBookings: v.number(),
    revenueDkk: v.number(),
  }),
  serviceBreakdown: v.array(
    v.object({
      serviceId: idSchema,
      name: v.string(),
      bookings: v.number(),
    }),
  ),
});

export const platformAnalyticsSchema = v.object({
  range: v.object({
    startsAt: timestampSchema,
    endsAt: timestampSchema,
  }),
  totals: v.object({
    salons: v.number(),
    bookings: v.number(),
    activeSalons: v.number(),
  }),
  salons: v.array(
    v.object({
      salon: salonSchema,
      bookings: v.number(),
    }),
  ),
});

export function jsonContent(
  schema: Parameters<typeof resolver>[0],
  example?: unknown,
) {
  return {
    "application/json":
      example === undefined
        ? { schema: resolver(schema) }
        : { schema: resolver(schema), example },
  };
}

export const examples = {
  salon: {
    _id: "sln_01",
    name: "Cut&Go Nørrebro",
    slug: "cut-and-go-norrebro",
    description: "Drop-in and booking salon in Copenhagen.",
    phone: "+45 12 34 56 78",
    email: "norrebro@cutandgo.dk",
    addressLine1: "Nørrebrogade 120",
    postalCode: "2200",
    city: "Copenhagen",
    country: "Denmark",
    timezone: "Europe/Copenhagen",
    latitude: 55.699,
    longitude: 12.548,
    ownerUserId: "usr_admin_01",
    isActive: true,
    createdAt: 1773651600000,
    updatedAt: 1773651600000,
  },
  employee: {
    _id: "emp_01",
    salonId: "sln_01",
    firstName: "Sofie",
    lastName: "Jensen",
    displayName: "Sofie",
    role: "staff",
    email: "sofie@cutandgo.dk",
    phone: "+45 22 33 44 55",
    bio: "Specialist in fades and quick cuts.",
    workerPin: "1243",
    isActive: true,
    createdAt: 1773651600000,
    updatedAt: 1773651600000,
  },
  service: {
    _id: "srv_01",
    salonId: "sln_01",
    name: "Herreklip",
    description: "Classic men’s haircut.",
    durationMinutes: 30,
    priceDkk: 299,
    category: "Haircut",
    employeeIds: ["emp_01"],
    isActive: true,
    createdAt: 1773651600000,
    updatedAt: 1773651600000,
  },
  appUser: {
    _id: "usr_01",
    authUserId: "auth_01",
    email: "ada@example.com",
    fullName: "Ada Lovelace",
    phone: "+45 11 22 33 44",
    role: "client",
    salonId: "sln_01",
    employeeId: "emp_01",
    isActive: true,
    createdAt: 1773651600000,
    updatedAt: 1773651600000,
  },
};

export const bookingExpandedExample = {
  _id: "bkg_01",
  salonId: "sln_01",
  clientUserId: "usr_01",
  employeeId: "emp_01",
  serviceId: "srv_01",
  createdByUserId: "usr_01",
  status: "confirmed",
  startsAt: 1773651600000,
  endsAt: 1773653400000,
  notes: "Kort i siderne",
  customerName: "Ada Lovelace",
  customerEmail: "ada@example.com",
  customerPhone: "+45 11 22 33 44",
  createdAt: 1773648000000,
  updatedAt: 1773648000000,
  salon: examples.salon,
  employee: examples.employee,
  service: examples.service,
  client: examples.appUser,
};
