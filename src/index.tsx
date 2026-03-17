import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { renderer } from "./renderer";
import isAlive from "./routes/isAlive";
import users from "./routes/users";
import salons from "./routes/salons";
import bookings from "./routes/bookings";
import admin from "./routes/admin";
import staff from "./routes/staff";
import type { AppBindings } from "./lib/convex";

const app = new Hono<{ Bindings: AppBindings }>();
const api = new Hono<{ Bindings: AppBindings }>().basePath("/api/v1");

api.use(renderer);

api.route("/is-alive", isAlive);
api.route("/users", users);
api.route("/salons", salons);
api.route("/bookings", bookings);
api.route("/admin", admin);
api.route("/staff", staff);

app.route("/", api);

app.get(
  "/openapi.json",
  openAPIRouteHandler(api, {
    includeEmptyPaths: true,
    documentation: {
      openapi: "3.1.0",
      info: {
        title: "Cut&Go API",
        version: "1.0.0",
        description:
          "OpenAPI document for Cut&Go booking, admin, and staff endpoints.",
      },
      tags: [
        {
          name: "System",
          description: "Operational and health endpoints.",
        },
        {
          name: "Users",
          description: "Authenticated user profile and role management.",
        },
        {
          name: "Booking Discovery",
          description: "Endpoints used to start and prepare the booking flow.",
        },
        {
          name: "Bookings",
          description: "Booking creation, confirmation, cancellation, and updates.",
        },
        {
          name: "Admin",
          description: "Administrative maintenance and analytics endpoints.",
        },
        {
          name: "Staff",
          description: "Staff login, schedule overview, and sickness handling.",
        },
      ],
      servers: [
        {
          url: "/",
          description: "Current deployment",
        },
      ],
    },
  }),
);

app.get(
  "/docs",
  Scalar({
    url: "/openapi.json",
    pageTitle: "Cut&Go API Docs",
    theme: "alternate",
  }),
);

export default app;
