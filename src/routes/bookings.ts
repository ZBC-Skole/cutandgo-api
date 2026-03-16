import { Hono } from "hono";
import {
  api,
  createConvexClient,
  parseJsonBody,
  toErrorResponse,
  type AppBindings,
} from "../lib/convex";

type UpdateBookingStatusBody = {
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
};

type CancelBookingBody = {
  reason?: string;
};

const bookings = new Hono<{ Bindings: AppBindings }>();

bookings.get("/:bookingId/confirmation", async (c) => {
  try {
    const client = createConvexClient(c);
    const confirmation = await client.query(api.core.getBookingConfirmation, {
      bookingId: c.req.param("bookingId") as never,
    });
    return c.json({ data: confirmation });
  } catch (error) {
    return toErrorResponse(c, error);
  }
});

bookings.patch("/:bookingId/status", async (c) => {
  try {
    const client = createConvexClient(c);
    const body =
      (await parseJsonBody<UpdateBookingStatusBody>(c)) as UpdateBookingStatusBody;
    const booking = await client.mutation(api.core.updateBookingStatus, {
      bookingId: c.req.param("bookingId") as never,
      status: body.status as never,
    });
    return c.json({ data: booking });
  } catch (error) {
    return toErrorResponse(c, error);
  }
});

bookings.post("/:bookingId/cancel", async (c) => {
  try {
    const client = createConvexClient(c);
    const body = (await parseJsonBody<CancelBookingBody>(c)) as CancelBookingBody;
    const booking = await client.mutation(api.core.cancelBooking, {
      bookingId: c.req.param("bookingId") as never,
      reason: body.reason,
    });
    return c.json({ data: booking });
  } catch (error) {
    return toErrorResponse(c, error);
  }
});

export default bookings;
