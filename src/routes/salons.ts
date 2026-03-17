import { Hono } from "hono";
import {
  api,
  createConvexClient,
  parseJsonBody,
  toErrorResponse,
  type AppBindings,
} from "../lib/convex";
import { describeRoute } from "hono-openapi";
import * as v from "valibot";
import {
  availabilityResponseSchema,
  bookingExpandedExample,
  bookingExpandedSchema,
  employeeSchema,
  examples,
  jsonContent,
  nearestSalonSchema,
  openingHoursSchema,
  productSchema,
  salonAnalyticsSchema,
  salonFoundationSchema,
  salonSchema,
  serviceSchema,
} from "../docs/openapi";

type CreateSalonBody = {
  name: string;
  slug: string;
  description?: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode: string;
  city: string;
  country: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
};

type CreateEmployeeBody = {
  firstName: string;
  lastName: string;
  displayName: string;
  role: "staff" | "admin";
  email?: string;
  phone?: string;
  bio?: string;
  workerPin?: string;
};

type CreateServiceBody = {
  name: string;
  description?: string;
  durationMinutes: number;
  priceDkk: number;
  category?: string;
  employeeIds: string[];
};

type CreateBookingBody = {
  employeeId: string;
  serviceId: string;
  startsAt: number;
  endsAt?: number;
  notes?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
};

type CreateProductBody = {
  name: string;
  brand?: string;
  description?: string;
  category?: string;
  priceDkk: number;
  stockQuantity: number;
  sku?: string;
};

type CreateOpeningHoursBody = {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
  employeeId?: string;
  validFrom?: number;
  validTo?: number;
};

type UpdateSalonLocationBody = {
  latitude: number;
  longitude: number;
};

type UpdateOpeningHoursBody = {
  opensAt?: string;
  closesAt?: string;
  isClosed?: boolean;
  validFrom?: number;
  validTo?: number;
};

const salons = new Hono<{ Bindings: AppBindings }>();

salons.get(
  "/nearest",
  describeRoute({
    tags: ["Booking Discovery"],
    summary: "Find nearest salon",
    responses: {
      200: {
        description: "Nearest salon based on coordinates.",
        content: jsonContent(
          v.object({ data: nearestSalonSchema }),
          {
            data: {
              nearestSalon: examples.salon,
              distanceKm: 1.2,
              candidates: [
                {
                  salon: examples.salon,
                  distanceKm: 1.2,
                },
              ],
            },
          },
        ),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const nearestSalon = await client.query(api.core.findNearestSalon, {
      latitude: Number(c.req.query("latitude")),
      longitude: Number(c.req.query("longitude")),
    });
    return c.json({ data: nearestSalon });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

salons.get(
  "/",
  describeRoute({
    tags: ["Booking Discovery"],
    summary: "List salons",
    responses: {
      200: {
        description: "Active salons.",
        content: jsonContent(
          v.object({ data: v.array(salonSchema) }),
          { data: [examples.salon] },
        ),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const salonList = await client.query(api.core.listSalons, {});
    return c.json({ data: salonList });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

salons.post(
  "/",
  describeRoute({
    tags: ["Admin"],
    summary: "Create salon",
    responses: {
      201: {
        description: "Salon created.",
        content: jsonContent(v.object({ data: salonSchema }), { data: examples.salon }),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const body = (await parseJsonBody<CreateSalonBody>(c)) as CreateSalonBody;
    const salon = await client.mutation(api.core.createSalon, body as never);
    return c.json({ data: salon }, 201);
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

salons.get(
  "/:salonId/foundation",
  describeRoute({
    tags: ["Booking Discovery"],
    summary: "Get salon foundation data",
    responses: {
      200: {
        description: "Salon foundation data.",
        content: jsonContent(
          v.object({ data: salonFoundationSchema }),
          {
            data: {
              salon: examples.salon,
              employees: [examples.employee],
              services: [examples.service],
              openingHours: [],
              products: [],
            },
          },
        ),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const foundation = await client.query(api.core.getSalonFoundation, {
      salonId: c.req.param("salonId") as never,
    });
    return c.json({ data: foundation });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

salons.get(
  "/:salonId/employees",
  describeRoute({
    tags: ["Booking Discovery"],
    summary: "List salon employees",
    responses: {
      200: {
        description: "Active employees for a salon.",
        content: jsonContent(
          v.object({ data: v.array(employeeSchema) }),
          { data: [examples.employee] },
        ),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const employees = await client.query(api.core.listSalonEmployees, {
      salonId: c.req.param("salonId") as never,
    });
    return c.json({ data: employees });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

salons.get(
  "/:salonId/services",
  describeRoute({
    tags: ["Booking Discovery"],
    summary: "List salon services",
    responses: {
      200: {
        description: "Services for a salon or employee.",
        content: jsonContent(
          v.object({ data: v.array(serviceSchema) }),
          { data: [examples.service] },
        ),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const employeeId = c.req.query("employeeId");
    const services = await client.query(api.core.listSalonServices, {
      salonId: c.req.param("salonId") as never,
      employeeId: employeeId ? (employeeId as never) : undefined,
    });
    return c.json({ data: services });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

salons.get(
  "/:salonId/available-slots",
  describeRoute({
    tags: ["Booking Discovery"],
    summary: "Get available booking slots",
    responses: {
      200: {
        description: "Available time slots.",
        content: jsonContent(
          v.object({ data: availabilityResponseSchema }),
          {
            data: {
              salon: examples.salon,
              employee: examples.employee,
              service: examples.service,
              availability: [
                {
                  date: "2026-03-17",
                  slots: [
                    {
                      employeeId: "emp_01",
                      serviceId: "srv_01",
                      startsAt: 1773651600000,
                      endsAt: 1773653400000,
                    },
                  ],
                },
              ],
            },
          },
        ),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const days = c.req.query("days");
    const availability = await client.query(api.core.getAvailableTimeSlots, {
      salonId: c.req.param("salonId") as never,
      employeeId: c.req.query("employeeId") as never,
      serviceId: c.req.query("serviceId") as never,
      startsAt: Number(c.req.query("startsAt")),
      days: days ? Number(days) : undefined,
    });
    return c.json({ data: availability });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

salons.post(
  "/:salonId/employees",
  describeRoute({
    tags: ["Admin"],
    summary: "Create salon employee",
    responses: {
      201: {
        description: "Employee created.",
        content: jsonContent(v.object({ data: employeeSchema }), { data: examples.employee }),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const body = (await parseJsonBody<CreateEmployeeBody>(c)) as CreateEmployeeBody;
    const employee = await client.mutation(api.core.createEmployee, {
      ...body,
      salonId: c.req.param("salonId") as never,
    } as never);
    return c.json({ data: employee }, 201);
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

salons.post(
  "/:salonId/services",
  describeRoute({
    tags: ["Admin"],
    summary: "Create salon service",
    responses: {
      201: {
        description: "Service created.",
        content: jsonContent(v.object({ data: serviceSchema }), { data: examples.service }),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const body = (await parseJsonBody<CreateServiceBody>(c)) as CreateServiceBody;
    const service = await client.mutation(api.core.createService, {
      ...body,
      salonId: c.req.param("salonId") as never,
    } as never);
    return c.json({ data: service }, 201);
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

salons.post(
  "/:salonId/bookings",
  describeRoute({
    tags: ["Bookings"],
    summary: "Create booking",
    responses: {
      201: {
        description: "Booking created.",
        content: jsonContent(
          v.object({ data: bookingExpandedSchema }),
          { data: bookingExpandedExample },
        ),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const body = (await parseJsonBody<CreateBookingBody>(c)) as CreateBookingBody;
    const booking = await client.mutation(api.core.createBooking, {
      ...body,
      salonId: c.req.param("salonId") as never,
    } as never);
    return c.json({ data: booking }, 201);
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

salons.patch(
  "/:salonId/location",
  describeRoute({
    tags: ["Admin"],
    summary: "Update salon location",
    responses: {
      200: {
        description: "Salon location updated.",
        content: jsonContent(v.object({ data: salonSchema }), { data: examples.salon }),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const body =
      (await parseJsonBody<UpdateSalonLocationBody>(c)) as UpdateSalonLocationBody;
    const salon = await client.mutation(api.core.updateSalonLocation, {
      salonId: c.req.param("salonId") as never,
      latitude: body.latitude,
      longitude: body.longitude,
    });
    return c.json({ data: salon });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

salons.post(
  "/:salonId/products",
  describeRoute({
    tags: ["Admin"],
    summary: "Create product",
    responses: {
      201: {
        description: "Product created.",
        content: jsonContent(
          v.object({ data: productSchema }),
          {
            data: {
              _id: "prd_01",
              salonId: "sln_01",
              name: "Sea Salt Spray",
              brand: "Cut&Go",
              description: "Texture spray for styling.",
              category: "Styling",
              priceDkk: 149,
              stockQuantity: 24,
              sku: "CG-SEA-SALT",
              isActive: true,
              createdAt: 1773651600000,
              updatedAt: 1773651600000,
            },
          },
        ),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const body = (await parseJsonBody<CreateProductBody>(c)) as CreateProductBody;
    const product = await client.mutation(api.core.createProduct, {
      ...body,
      salonId: c.req.param("salonId") as never,
    } as never);
    return c.json({ data: product }, 201);
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

salons.post(
  "/:salonId/opening-hours",
  describeRoute({
    tags: ["Admin"],
    summary: "Create opening hours",
    responses: {
      201: {
        description: "Opening hours created.",
        content: jsonContent(
          v.object({ data: openingHoursSchema }),
          {
            data: {
              _id: "oh_01",
              salonId: "sln_01",
              dayOfWeek: 2,
              opensAt: "09:00",
              closesAt: "17:00",
              isClosed: false,
              createdAt: 1773651600000,
              updatedAt: 1773651600000,
            },
          },
        ),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const body =
      (await parseJsonBody<CreateOpeningHoursBody>(c)) as CreateOpeningHoursBody;
    const openingHours = await client.mutation(api.core.createOpeningHours, {
      ...body,
      salonId: c.req.param("salonId") as never,
    } as never);
    return c.json({ data: openingHours }, 201);
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

salons.patch(
  "/:salonId/opening-hours/:openingHoursId",
  describeRoute({
    tags: ["Admin"],
    summary: "Update opening hours",
    responses: {
      200: {
        description: "Opening hours updated.",
        content: jsonContent(
          v.object({ data: openingHoursSchema }),
          {
            data: {
              _id: "oh_01",
              salonId: "sln_01",
              dayOfWeek: 2,
              opensAt: "10:00",
              closesAt: "18:00",
              isClosed: false,
              createdAt: 1773651600000,
              updatedAt: 1773655200000,
            },
          },
        ),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const body =
      (await parseJsonBody<UpdateOpeningHoursBody>(c)) as UpdateOpeningHoursBody;
    const openingHours = await client.mutation(api.core.updateOpeningHours, {
      openingHoursId: c.req.param("openingHoursId") as never,
      opensAt: body.opensAt,
      closesAt: body.closesAt,
      isClosed: body.isClosed,
      validFrom: body.validFrom,
      validTo: body.validTo,
    });
    return c.json({ data: openingHours });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

salons.get(
  "/:salonId/analytics",
  describeRoute({
    tags: ["Admin"],
    summary: "Get salon analytics",
    responses: {
      200: {
        description: "Salon analytics.",
        content: jsonContent(
          v.object({ data: salonAnalyticsSchema }),
          {
            data: {
              salon: examples.salon,
              range: {
                startsAt: 1773046800000,
                endsAt: 1773651600000,
              },
              totals: {
                totalBookings: 42,
                cancelledBookings: 3,
                completedBookings: 34,
                confirmedBookings: 5,
                revenueDkk: 10166,
              },
              serviceBreakdown: [
                {
                  serviceId: "srv_01",
                  name: "Herreklip",
                  bookings: 18,
                },
              ],
            },
          },
        ),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const startsAt = c.req.query("startsAt");
    const endsAt = c.req.query("endsAt");
    const analytics = await client.query(api.core.getSalonAnalytics, {
      salonId: c.req.param("salonId") as never,
      startsAt: startsAt ? Number(startsAt) : undefined,
      endsAt: endsAt ? Number(endsAt) : undefined,
    });
    return c.json({ data: analytics });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

export default salons;
