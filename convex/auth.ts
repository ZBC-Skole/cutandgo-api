import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

const defaultSiteUrl = "http://localhost:5173";
const defaultAuthUrl = "http://localhost:3211";
export const authComponent = createClient<DataModel>(components.betterAuth);

function isLoopbackHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function withHostname(url: URL, hostname: string) {
  const nextUrl = new URL(url.toString());
  nextUrl.hostname = hostname;
  return nextUrl.toString();
}

function isLoopbackOrigin(origin: string) {
  try {
    return isLoopbackHostname(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function getTrustedOrigins(siteUrl: string, authUrl: string, request?: Request) {
  const origins = new Set([siteUrl]);
  const site = new URL(siteUrl);
  const auth = new URL(authUrl);
  const requestOrigin = request?.headers.get("origin");

  if (isLoopbackHostname(site.hostname) || isLoopbackHostname(auth.hostname)) {
    origins.add(withHostname(site, "localhost"));
    origins.add(withHostname(site, "127.0.0.1"));
    origins.add(withHostname(auth, "localhost"));
    origins.add(withHostname(auth, "127.0.0.1"));
  }

  if (requestOrigin && isLoopbackOrigin(requestOrigin)) {
    origins.add(requestOrigin);
  }

  return [...origins];
}

function getNormalizedAuthUrl(siteUrl: string, authUrl: string) {
  const site = new URL(siteUrl);
  const auth = new URL(authUrl);

  if (
    isLoopbackHostname(site.hostname) &&
    isLoopbackHostname(auth.hostname) &&
    site.hostname !== auth.hostname
  ) {
    return withHostname(auth, site.hostname);
  }

  return authUrl;
}

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl =
    process.env.SITE_URL ?? process.env.VITE_SITE_URL ?? defaultSiteUrl;
  const authUrl = getNormalizedAuthUrl(
    siteUrl,
    process.env.BETTER_AUTH_URL ??
      process.env.CONVEX_SITE_URL ??
      process.env.VITE_CONVEX_SITE_URL ??
      defaultAuthUrl,
  );

  return betterAuth({
    baseURL: authUrl,
    trustedOrigins: (request) => getTrustedOrigins(siteUrl, authUrl, request),
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [crossDomain({ siteUrl }), convex({ authConfig })],
  });
};

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
