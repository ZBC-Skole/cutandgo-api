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
  bookingExpandedExample,
  bookingExpandedSchema,
  employeeBookingsSchema,
  examples,
  jsonContent,
  nextCustomerSchema,
  sicknessCancellationSchema,
  staffLoginSchema,
} from "../docs/openapi";

type StaffLoginBody = {
  workerPin: string;
  salonId?: string;
};

type SicknessCancellationBody = {
  startsAt: number;
  endsAt: number;
  reason?: string;
};

const staff = new Hono<{ Bindings: AppBindings }>();

staff.post(
  "/login",
  describeRoute({
    tags: ["Staff"],
    summary: "Login with worker PIN",
    responses: {
      200: {
        description: "Staff member authenticated.",
        content: jsonContent(
          v.object({ data: staffLoginSchema }),
          {
            data: {
              authenticated: true,
              employee: examples.employee,
              salon: examples.salon,
            },
          },
        ),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const body = (await parseJsonBody<StaffLoginBody>(c)) as StaffLoginBody;
    const session = await client.query(api.core.staffLoginWithWorkerPin, {
      workerPin: body.workerPin,
      salonId: body.salonId as never,
    });
    return c.json({ data: session });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

staff.get(
  "/:employeeId/next-customer",
  describeRoute({
    tags: ["Staff"],
    summary: "Get next customer",
    responses: {
      200: {
        description: "Next customer for the employee.",
        content: jsonContent(
          v.object({ data: nextCustomerSchema }),
          {
            data: {
              employee: examples.employee,
              nextBooking: bookingExpandedExample,
            },
          },
        ),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const now = c.req.query("now");
    const nextCustomer = await client.query(api.core.getEmployeeNextCustomer, {
      employeeId: c.req.param("employeeId") as never,
      now: now ? Number(now) : undefined,
    });
    return c.json({ data: nextCustomer });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

staff.get(
  "/:employeeId/bookings",
  describeRoute({
    tags: ["Staff"],
    summary: "List employee bookings",
    responses: {
      200: {
        description: "Bookings for the employee.",
        content: jsonContent(
          v.object({ data: employeeBookingsSchema }),
          {
            data: {
              employee: examples.employee,
              bookings: [bookingExpandedExample],
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
    const bookings = await client.query(api.core.getEmployeeBookings, {
      employeeId: c.req.param("employeeId") as never,
      startsAt: startsAt ? Number(startsAt) : undefined,
      endsAt: endsAt ? Number(endsAt) : undefined,
    });
    return c.json({ data: bookings });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

staff.get(
  "/bookings/:bookingId",
  describeRoute({
    tags: ["Staff"],
    summary: "Get booking details for staff",
    responses: {
      200: {
        description: "Detailed booking information.",
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
    const booking = await client.query(api.core.getBookingDetailsForStaff, {
      bookingId: c.req.param("bookingId") as never,
    });
    return c.json({ data: booking });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

staff.post(
  "/:employeeId/sickness-cancellation",
  describeRoute({
    tags: ["Staff"],
    summary: "Cancel bookings due to sickness",
    responses: {
      200: {
        description: "Affected bookings cancelled.",
        content: jsonContent(
          v.object({ data: sicknessCancellationSchema }),
          {
            data: {
              employee: examples.employee,
              cancelledCount: 2,
              bookings: [
                {
                  ...bookingExpandedExample,
                  status: "cancelled",
                  cancellationReason: "Cancelled due to staff sickness.",
                  cancelledAt: 1773649800000,
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
    const body =
      (await parseJsonBody<SicknessCancellationBody>(c)) as SicknessCancellationBody;
    const cancellation = await client.mutation(
      api.core.cancelEmployeeBookingsForSickness,
      {
        employeeId: c.req.param("employeeId") as never,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        reason: body.reason,
      },
    );
    return c.json({ data: cancellation });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

export default staff;
