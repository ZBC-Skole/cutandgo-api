import { Hono } from "hono";
import { cors } from "hono/cors";
import { openAPIRouteHandler } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { renderer } from "./renderer";

const app = new Hono();
const api = new Hono().basePath("/api/v1");

api.use(renderer);

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
