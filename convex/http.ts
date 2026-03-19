import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  HonoWithConvex,
  HttpRouterWithHono,
} from "convex-helpers/server/hono";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { createAuth } from "./auth";
import { getSiteUrl } from "./lib/authEnv";

const app: HonoWithConvex<ActionCtx> = new Hono();

app.use(
  "/api/auth/*",
  cors({
    origin: (origin) => {
      const siteUrl = getSiteUrl();

      if (!siteUrl) {
        return "";
      }

      return origin === siteUrl ? siteUrl : "";
    },
    allowHeaders: ["Content-Type", "Authorization", "Better-Auth-Cookie"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Set-Better-Auth-Cookie"],
    maxAge: 600,
    credentials: true,
  }),
);

app.use(
  "/api/staff/*",
  cors({
    origin: (origin) => {
      const siteUrl = getSiteUrl();

      if (!siteUrl) {
        return "";
      }

      return origin === siteUrl ? siteUrl : "";
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Set-Cookie"],
    maxAge: 600,
    credentials: true,
  }),
);

app.get("/.well-known/openid-configuration", (c) => {
  return c.redirect("/api/auth/convex/.well-known/openid-configuration");
});

app.post("/api/staff/pin-login", async (c) => {
  const { personalId, pin } = await c.req.json<{
    personalId?: string;
    pin?: string;
  }>();

  if (!personalId || !pin) {
    return c.json(
      { message: "personalId and pin are required" },
      400,
    );
  }

  const payload = await c.env.runQuery(internal.domain.getStaffLoginPayload, {
    personalId,
    pin,
  });

  if (!payload) {
    return c.json({ message: "Invalid staff credentials" }, 401);
  }

  const auth = createAuth(c.env);
  const authResponse = await auth.api.signInEmail({
    body: {
      email: payload.email,
      password: payload.loginSecret,
    },
    asResponse: true,
  });

  if (!authResponse.ok) {
    return c.json({ message: "Staff sign-in failed" }, 401);
  }

  const headers = new Headers();
  authResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      headers.append("set-cookie", value);
    }
  });

  return new Response(
    JSON.stringify({
      authenticated: true,
      employee: payload.employee,
      salon: payload.salon,
    }),
    {
      status: 200,
      headers,
    },
  );
});

app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

export default new HttpRouterWithHono(app);
