import { Hono } from "hono";
import {
  api,
  createConvexClient,
  parseJsonBody,
  toErrorResponse,
  type AppBindings,
} from "../lib/convex";

type StaffLoginBody = {
  personalId: string;
};

type SicknessCancellationBody = {
  personalId: string;
  startsAt: number;
  endsAt: number;
  reason?: string;
};

const staff = new Hono<{ Bindings: AppBindings }>();

staff.post("/login", async (c) => {
  try {
    const client = createConvexClient(c);
    const body = (await parseJsonBody<StaffLoginBody>(c)) as StaffLoginBody;
    const session = await client.query(api.core.staffLoginWithPersonalId, {
      personalId: body.personalId,
    });
    return c.json({ data: session });
  } catch (error) {
    return toErrorResponse(c, error);
  }
});

staff.get("/:employeeId/next-customer", async (c) => {
  try {
    const client = createConvexClient(c);
    const now = c.req.query("now");
    const nextCustomer = await client.query(api.core.getEmployeeNextCustomer, {
      employeeId: c.req.param("employeeId") as never,
      personalId: c.req.query("personalId") as never,
      now: now ? Number(now) : undefined,
    });
    return c.json({ data: nextCustomer });
  } catch (error) {
    return toErrorResponse(c, error);
  }
});

staff.get("/:employeeId/bookings", async (c) => {
  try {
    const client = createConvexClient(c);
    const startsAt = c.req.query("startsAt");
    const endsAt = c.req.query("endsAt");
    const bookings = await client.query(api.core.getEmployeeBookings, {
      employeeId: c.req.param("employeeId") as never,
      personalId: c.req.query("personalId") as never,
      startsAt: startsAt ? Number(startsAt) : undefined,
      endsAt: endsAt ? Number(endsAt) : undefined,
    });
    return c.json({ data: bookings });
  } catch (error) {
    return toErrorResponse(c, error);
  }
});

staff.get("/bookings/:bookingId", async (c) => {
  try {
    const client = createConvexClient(c);
    const booking = await client.query(api.core.getBookingDetailsForStaff, {
      bookingId: c.req.param("bookingId") as never,
      personalId: c.req.query("personalId") as never,
    });
    return c.json({ data: booking });
  } catch (error) {
    return toErrorResponse(c, error);
  }
});

staff.post("/:employeeId/sickness-cancellation", async (c) => {
  try {
    const client = createConvexClient(c);
    const body =
      (await parseJsonBody<SicknessCancellationBody>(c)) as SicknessCancellationBody;
    const cancellation = await client.mutation(
      api.core.cancelEmployeeBookingsForSickness,
      {
        employeeId: c.req.param("employeeId") as never,
        personalId: body.personalId,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        reason: body.reason,
      },
    );
    return c.json({ data: cancellation });
  } catch (error) {
    return toErrorResponse(c, error);
  }
});

export default staff;
