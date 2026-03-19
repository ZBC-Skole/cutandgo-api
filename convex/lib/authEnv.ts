const DEFAULT_CONVEX_SITE_URL = "http://localhost:3211";

function firstDefined(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.length > 0);
}

export function getAuthBaseUrl() {
  return (
    firstDefined(
      process.env.BETTER_AUTH_URL,
      process.env.CONVEX_SITE_URL,
      process.env.VITE_CONVEX_SITE_URL,
    ) ?? DEFAULT_CONVEX_SITE_URL
  );
}

export function getSiteUrl() {
  return firstDefined(process.env.SITE_URL, process.env.VITE_SITE_URL);
}

export function getTrustedOrigins() {
  const origins = new Set<string>([getAuthBaseUrl()]);
  const siteUrl = getSiteUrl();

  if (siteUrl) {
    origins.add(siteUrl);
  }

  return [...origins];
}
