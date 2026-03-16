import { Hono } from "hono";
import {
  api,
  createConvexClient,
  parseJsonBody,
  toErrorResponse,
  type AppBindings,
} from "../lib/convex";

type CreateEmployeeBody = {
  firstName: string;
  lastName: string;
  displayName: string;
  role: "staff" | "admin";
  email?: string;
  phone?: string;
  bio?: string;
  personalId?: string;
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

admin.post("/salons/:salonId/employees", async (c) => {
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
});

admin.post("/salons/:salonId/products", async (c) => {
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
});

admin.post("/salons/:salonId/opening-hours", async (c) => {
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
});

admin.patch("/opening-hours/:openingHoursId", async (c) => {
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
});

admin.patch("/salons/:salonId/location", async (c) => {
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
});

admin.get("/analytics", async (c) => {
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
});

admin.get("/salons/:salonId/analytics", async (c) => {
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
});

export default admin;
