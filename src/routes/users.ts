import { Hono } from "hono";
import {
  api,
  createConvexClient,
  parseJsonBody,
  toErrorResponse,
  type AppBindings,
} from "../lib/convex";

type BootstrapBody = {
  phone?: string;
};

type AssignRoleBody = {
  role: "client" | "staff" | "admin";
  salonId?: string;
  employeeId?: string;
};

const users = new Hono<{ Bindings: AppBindings }>();

users.get("/me", async (c) => {
  try {
    const client = createConvexClient(c);
    const viewer = await client.query(api.core.getViewerContext, {});
    return c.json({ data: viewer });
  } catch (error) {
    return toErrorResponse(c, error);
  }
});

users.post("/me/bootstrap", async (c) => {
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
});

users.patch("/:appUserId/role", async (c) => {
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
});

export default users;
