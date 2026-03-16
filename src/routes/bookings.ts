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

const bookings = new Hono<{ Bindings: AppBindings }>();

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

export default bookings;
