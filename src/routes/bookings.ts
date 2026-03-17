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
  bookingConfirmationSchema,
  bookingExpandedExample,
  bookingExpandedSchema,
  jsonContent,
} from "../docs/openapi";

type UpdateBookingStatusBody = {
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
};

type CancelBookingBody = {
  reason?: string;
};

const bookings = new Hono<{ Bindings: AppBindings }>();

bookings.get(
  "/:bookingId/confirmation",
  describeRoute({
    tags: ["Bookings"],
    summary: "Get booking confirmation",
    responses: {
      200: {
        description: "Booking confirmation details.",
        content: jsonContent(
          v.object({ data: bookingConfirmationSchema }),
          {
            data: {
              booking: bookingExpandedExample,
              confirmation: {
                bookingId: "bkg_01",
                status: "confirmed",
                startsAt: 1773651600000,
                endsAt: 1773653400000,
              },
            },
          },
        ),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const confirmation = await client.query(api.core.getBookingConfirmation, {
      bookingId: c.req.param("bookingId") as never,
    });
    return c.json({ data: confirmation });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

bookings.patch(
  "/:bookingId/status",
  describeRoute({
    tags: ["Bookings", "Admin", "Staff"],
    summary: "Update booking status",
    responses: {
      200: {
        description: "Booking status updated.",
        content: jsonContent(
          v.object({ data: bookingExpandedSchema }),
          {
            data: {
              ...bookingExpandedExample,
              status: "completed",
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
      (await parseJsonBody<UpdateBookingStatusBody>(c)) as UpdateBookingStatusBody;
    const booking = await client.mutation(api.core.updateBookingStatus, {
      bookingId: c.req.param("bookingId") as never,
      status: body.status as never,
    });
    return c.json({ data: booking });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

bookings.post(
  "/:bookingId/cancel",
  describeRoute({
    tags: ["Bookings"],
    summary: "Cancel booking",
    responses: {
      200: {
        description: "Booking cancelled.",
        content: jsonContent(
          v.object({ data: bookingExpandedSchema }),
          {
            data: {
              ...bookingExpandedExample,
              status: "cancelled",
              cancellationReason: "Customer requested cancellation",
              cancelledAt: 1773649800000,
            },
          },
        ),
      },
    },
  }),
  async (c) => {
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
  },
);

export default bookings;
