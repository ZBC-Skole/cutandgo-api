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
  employeeSchema,
  examples,
  jsonContent,
  openingHoursSchema,
  platformAnalyticsSchema,
  productSchema,
  salonAnalyticsSchema,
  salonSchema,
} from "../docs/openapi";

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

type UpdateOpeningHoursBody = {
  opensAt?: string;
  closesAt?: string;
  isClosed?: boolean;
  validFrom?: number;
  validTo?: number;
};

type UpdateSalonLocationBody = {
  latitude: number;
  longitude: number;
};

const admin = new Hono<{ Bindings: AppBindings }>();

admin.post(
  "/salons/:salonId/employees",
  describeRoute({
    tags: ["Admin"],
    summary: "Create employee",
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

admin.post(
  "/salons/:salonId/products",
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

admin.post(
  "/salons/:salonId/opening-hours",
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

admin.patch(
  "/opening-hours/:openingHoursId",
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

admin.patch(
  "/salons/:salonId/location",
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

admin.get(
  "/analytics",
  describeRoute({
    tags: ["Admin"],
    summary: "Get platform analytics",
    responses: {
      200: {
        description: "Platform analytics.",
        content: jsonContent(
          v.object({ data: platformAnalyticsSchema }),
          {
            data: {
              range: {
                startsAt: 1773046800000,
                endsAt: 1773651600000,
              },
              totals: {
                salons: 3,
                bookings: 128,
                activeSalons: 3,
              },
              salons: [
                {
                  salon: examples.salon,
                  bookings: 42,
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
    const analytics = await client.query(api.core.getPlatformAnalytics, {
      startsAt: startsAt ? Number(startsAt) : undefined,
      endsAt: endsAt ? Number(endsAt) : undefined,
    });
    return c.json({ data: analytics });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

admin.get(
  "/salons/:salonId/analytics",
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

export default admin;
