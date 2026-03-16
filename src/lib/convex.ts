import type { Context } from "hono";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

export type AppBindings = {
  CONVEX_URL: string;
};

export type AppContext = Context<{ Bindings: AppBindings }>;

const convexCookieCandidates = [
  "__Secure-better-auth.convex_jwt",
  "better-auth.convex_jwt",
  "__Secure-better-auth-convex_jwt",
  "better-auth-convex_jwt",
  "__Secure-convex_jwt",
  "convex_jwt",
];

function readCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) {
    return undefined;
  }

  const cookies = cookieHeader.split(/;\s*/);
  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const cookieName = cookie.slice(0, separatorIndex);
    if (cookieName === name) {
      return decodeURIComponent(cookie.slice(separatorIndex + 1));
    }
  }

  return undefined;
}

export function getConvexToken(c: AppContext) {
  const authorizationHeader = c.req.header("Authorization");
  if (authorizationHeader?.startsWith("Bearer ")) {
    return authorizationHeader.slice("Bearer ".length);
  }

  const cookieHeader = c.req.header("cookie");
  for (const cookieName of convexCookieCandidates) {
    const token = readCookieValue(cookieHeader, cookieName);
    if (token) {
      return token;
    }
  }

  return undefined;
}

export function createConvexClient(c: AppContext) {
  const convexUrl = c.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL binding.");
  }

  const client = new ConvexHttpClient(convexUrl, {
    fetch: globalThis.fetch.bind(globalThis),
  });

  const token = getConvexToken(c);
  if (token) {
    client.setAuth(token);
  }

  return client;
}

export async function parseJsonBody<T>(c: AppContext): Promise<Partial<T>> {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {};
  }

  try {
    return await c.req.json<Partial<T>>();
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

export function toErrorResponse(c: AppContext, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unexpected server error.";

  if (
    message.includes("Unauthenticated") ||
    message.includes("Missing CONVEX_URL binding")
  ) {
    const status = message.includes("Missing CONVEX_URL binding") ? 500 : 401;
    return c.json({ error: message }, status);
  }

  if (
    message.includes("Insufficient permissions") ||
    message.includes("does not have access")
  ) {
    return c.json({ error: message }, 403);
  }

  if (message.toLowerCase().includes("not found")) {
    return c.json({ error: message }, 404);
  }

  if (
    message.includes("must") ||
    message.includes("already exists") ||
    message.includes("does not belong") ||
    message.includes("missing") ||
    message.includes("outside opening hours") ||
    message.includes("no longer available") ||
    message.includes("cannot be cancelled") ||
    message.includes("Invalid personal ID") ||
    message.includes("No salons with location data found")
  ) {
    return c.json({ error: message }, 400);
  }

  console.error(error);
  return c.json({ error: "Unexpected server error." }, 500);
}

export { api };
