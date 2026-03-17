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
  const convexUrl = c.env.CONVEX_URL ?? process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error(
      "Missing CONVEX_URL binding. Add CONVEX_URL to your Cloudflare bindings or local .env.local file.",
    );
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

function extractPrimaryErrorMessage(rawMessage: string) {
  return rawMessage
    .replace(/\[Request ID:[^\]]+\]\s*/g, "")
    .replace(/^Server Error\s*/i, "")
    .split("\n")[0]
    .trim();
}

function normalizeErrorMessage(rawMessage: string) {
  const message = extractPrimaryErrorMessage(rawMessage);

  if (message.includes("Unauthenticated")) {
    return {
      status: 401,
      message: "You need to sign in before calling this endpoint.",
    };
  }

  if (message.includes("Missing CONVEX_URL binding")) {
    return {
      status: 500,
      message:
        "Server configuration is missing CONVEX_URL. Add it to Cloudflare bindings or local .env.local.",
    };
  }

  if (
    message.includes("Insufficient permissions") ||
    message.includes("does not have access")
  ) {
    return {
      status: 403,
      message: "You do not have permission to access this resource.",
    };
  }

  if (message.toLowerCase().includes("not found")) {
    return {
      status: 404,
      message,
    };
  }

  if (
    message.includes("must") ||
    message.includes("already exists") ||
    message.includes("does not belong") ||
    message.includes("outside opening hours") ||
    message.includes("no longer available") ||
    message.includes("cannot be cancelled") ||
    message.includes("Invalid worker PIN") ||
    message.includes("No salons with location data found") ||
    message.includes("inactive") ||
    message.includes("missing")
  ) {
    return {
      status: 400,
      message,
    };
  }

  return null;
}

export function toErrorResponse(c: AppContext, error: unknown) {
  const rawMessage =
    error instanceof Error ? error.message : "Unexpected server error.";
  const normalized = normalizeErrorMessage(rawMessage);

  if (normalized) {
    return c.json(
      { error: normalized.message },
      { status: normalized.status as 400 | 401 | 403 | 404 | 500 },
    );
  }

  console.error(error);
  return c.json(
    { error: "Something went wrong on the server. Please try again." },
    500,
  );
}

export { api };
