import { Hono } from "hono";
import {
  api,
  createConvexClient,
  parseJsonBody,
  toErrorResponse,
  type AppBindings,
} from "../lib/convex";

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
  personalId?: string;
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

salons.get("/nearest", async (c) => {
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
});

salons.get("/", async (c) => {
  try {
    const client = createConvexClient(c);
    const salonList = await client.query(api.core.listSalons, {});
    return c.json({ data: salonList });
  } catch (error) {
    return toErrorResponse(c, error);
  }
});

salons.post("/", async (c) => {
  try {
    const client = createConvexClient(c);
    const body = (await parseJsonBody<CreateSalonBody>(c)) as CreateSalonBody;
    const salon = await client.mutation(api.core.createSalon, body as never);
    return c.json({ data: salon }, 201);
  } catch (error) {
    return toErrorResponse(c, error);
  }
});

salons.get("/:salonId/foundation", async (c) => {
  try {
    const client = createConvexClient(c);
    const foundation = await client.query(api.core.getSalonFoundation, {
      salonId: c.req.param("salonId") as never,
    });
    return c.json({ data: foundation });
  } catch (error) {
    return toErrorResponse(c, error);
  }
});

salons.get("/:salonId/employees", async (c) => {
  try {
    const client = createConvexClient(c);
    const employees = await client.query(api.core.listSalonEmployees, {
      salonId: c.req.param("salonId") as never,
    });
    return c.json({ data: employees });
  } catch (error) {
    return toErrorResponse(c, error);
  }
});

salons.get("/:salonId/services", async (c) => {
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
});

salons.get("/:salonId/available-slots", async (c) => {
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
});

salons.post("/:salonId/employees", async (c) => {
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

salons.post("/:salonId/services", async (c) => {
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
});

salons.post("/:salonId/bookings", async (c) => {
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
});

salons.patch("/:salonId/location", async (c) => {
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

salons.post("/:salonId/products", async (c) => {
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

salons.post("/:salonId/opening-hours", async (c) => {
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

salons.patch("/:salonId/opening-hours/:openingHoursId", async (c) => {
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

salons.get("/:salonId/analytics", async (c) => {
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

export default salons;
