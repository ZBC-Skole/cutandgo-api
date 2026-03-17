import { Hono } from "hono";
import type { Context } from "hono";
import { describeRoute } from "hono-openapi";
import type { AppBindings } from "../lib/convex";
import { jsonContent } from "../docs/openapi";
import * as v from "valibot";

const healthResponseSchema = v.object({
  message: v.string(),
});

const isAlive = new Hono<{ Bindings: AppBindings }>().get(
  "/",
  describeRoute({
    tags: ["System"],
    summary: "Health check",
    description: "Returns a simple health response to verify the API is alive.",
    responses: {
      200: {
        description: "API is reachable.",
        content: jsonContent(healthResponseSchema, { message: "I'm alive!" }),
      },
    },
  }),
  (c: Context) => c.json({ message: "I'm alive!" }),
);

export default isAlive;
