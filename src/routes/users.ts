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
import { appUserSchema, examples, jsonContent, viewerContextSchema } from "../docs/openapi";

type BootstrapBody = {
  phone?: string;
};

type AssignRoleBody = {
  role: "client" | "staff" | "admin";
  salonId?: string;
  employeeId?: string;
};

const users = new Hono<{ Bindings: AppBindings }>();

users.get(
  "/me",
  describeRoute({
    tags: ["Users"],
    summary: "Get current user context",
    responses: {
      200: {
        description: "Current authenticated user context.",
        content: jsonContent(viewerContextSchema, {
          authUser: {
            _id: "auth_01",
            name: "Ada Lovelace",
            email: "ada@example.com",
          },
          appUser: examples.appUser,
          salon: examples.salon,
          employee: examples.employee,
        }),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const viewer = await client.query(api.core.getViewerContext, {});
    return c.json({ data: viewer });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

users.post(
  "/me/bootstrap",
  describeRoute({
    tags: ["Users"],
    summary: "Bootstrap current user profile",
    responses: {
      201: {
        description: "User profile created or updated.",
        content: jsonContent(
          v.object({
            data: appUserSchema,
          }),
          {
            data: examples.appUser,
          },
        ),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const body = (await parseJsonBody<BootstrapBody>(c)) as BootstrapBody;
    const profile = await client.mutation(api.core.ensureCurrentUserProfile, {
      phone: body.phone,
    });
    return c.json({ data: profile }, 201);
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

users.patch(
  "/:appUserId/role",
  describeRoute({
    tags: ["Users", "Admin"],
    summary: "Assign role to user",
    responses: {
      200: {
        description: "User role updated.",
        content: jsonContent(
          v.object({
            data: appUserSchema,
          }),
          {
            data: {
              ...examples.appUser,
              role: "staff",
              salonId: examples.salon._id,
              employeeId: examples.employee._id,
            },
          },
        ),
      },
    },
  }),
  async (c) => {
  try {
    const client = createConvexClient(c);
    const body = (await parseJsonBody<AssignRoleBody>(c)) as AssignRoleBody;
    const updatedUser = await client.mutation(api.core.assignUserRole, {
      appUserId: c.req.param("appUserId") as never,
      role: body.role as never,
      salonId: body.salonId as never,
      employeeId: body.employeeId as never,
    });
    return c.json({ data: updatedUser });
  } catch (error) {
    return toErrorResponse(c, error);
  }
  },
);

export default users;
