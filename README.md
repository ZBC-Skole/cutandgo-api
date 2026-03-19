# Cut&Go API

Backend for the Cut&Go client applications.

This repository currently has two server surfaces:

1. A Hono app for API documentation and future REST endpoints.
2. A Convex HTTP app that hosts Better Auth for authentication.

If you are building the client, treat this README and the generated OpenAPI document as the source of truth for what is available right now.

## Current Status

The auth server is ready.

The business REST API under `/api/v1` is not fully mounted yet in the current branch, so the main stable integration point for a client today is authentication.

What is stable now:

- Better Auth endpoints under `/api/auth/*`
- OpenID metadata redirect under `/.well-known/openid-configuration`
- OpenAPI JSON at `/openapi.json`
- API docs UI at `/docs`

What is not stable yet:

- Domain endpoints for salons, bookings, staff, admin, and users

Build the client so auth is integrated first, and keep the domain API layer behind a small client wrapper so we can swap in the final `/api/v1` routes cleanly.

## Local Development URLs

When running locally with the current setup, these are the expected URLs:

- App/docs server: `http://localhost:5173`
- Convex API URL: `http://localhost:3210`
- Convex site URL: `http://localhost:3211`
- Better Auth base URL: `http://localhost:3211`

The local env file currently uses:

```env
CONVEX_URL=http://localhost:3210
VITE_CONVEX_URL=http://localhost:3210
VITE_CONVEX_SITE_URL=http://localhost:3211
VITE_SITE_URL=http://localhost:5173
```

The Convex deployment also needs:

- `BETTER_AUTH_SECRET`
- `SITE_URL`

## Client Integration Summary

If you are building a web client:

- Use `http://localhost:3211` as the Better Auth `baseURL`
- Send credentials with requests
- Expect cookie-based auth
- Allow the browser to store and send Better Auth cookies

If you are building Expo later:

- Keep the auth client isolated in its own module
- Use the Convex site URL as the auth server base URL
- Add the Expo Better Auth plugin later instead of changing the server shape

## Available Endpoints

### Auth

Base path:

```txt
/api/auth
```

Handled by Better Auth through Convex + Hono.

Common endpoints you will use from the client:

- `POST /api/auth/sign-in/email`
- `POST /api/auth/sign-up/email`
- `POST /api/auth/sign-out`
- `GET /api/auth/get-session`

There are more Better Auth endpoints than the list above. The exact surface comes from Better Auth itself, so when in doubt, inspect the running auth API from the client integration or Better Auth docs.

### OpenID Configuration

Root redirect:

```txt
GET /.well-known/openid-configuration
```

This redirects to:

```txt
GET /api/auth/convex/.well-known/openid-configuration
```

### API Documentation

- `GET /openapi.json`
- `GET /docs`

Note:

The OpenAPI shell exists today, but until the domain routes are mounted, it should not be treated as a complete business API contract.

## Auth Behavior

The server is configured with:

- Better Auth
- Convex adapter from `@convex-dev/better-auth`
- Email/password auth enabled
- Email verification disabled for now
- Trusted origins derived from `SITE_URL`
- Hono CORS around `/api/auth/*`

Current implications for client work:

- Browser clients must send `credentials: "include"`
- The frontend origin must match `SITE_URL`
- If `SITE_URL` is wrong, auth requests from the browser will fail CORS
- Sessions are server-managed through Better Auth cookies

## Required Request Settings For Web Clients

For fetch:

```ts
await fetch("http://localhost:3211/api/auth/get-session", {
  method: "GET",
  credentials: "include",
});
```

If you call auth endpoints manually, be aware of these headers used by the server:

- `Content-Type`
- `Authorization`
- `Better-Auth-Cookie`

The auth server may expose:

- `Set-Better-Auth-Cookie`

## Recommended Client Structure

Use three small modules instead of scattering API calls across the app:

1. `lib/auth-client.ts`
2. `lib/api-client.ts`
3. `lib/session.ts`

Recommended responsibilities:

- `auth-client.ts`: Better Auth client instance and sign-in/sign-up/sign-out/session helpers
- `api-client.ts`: future `/api/v1` wrapper for domain endpoints
- `session.ts`: current-user loading, auth guards, and app bootstrap logic

That separation will make the Expo client easier later.

## Suggested Web Client Auth Setup

For a browser client, the simplest mental model is:

1. Sign up or sign in via Better Auth.
2. Let Better Auth manage the session cookie.
3. Query the current session.
4. Use the authenticated session to call future protected API endpoints.

Example shape:

```ts
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3211",
  fetchOptions: {
    credentials: "include",
  },
});
```

If you are using React, keep auth state in a dedicated provider instead of coupling it directly to route components.

## Convex Auth Query

There is already a server-side Convex query for the authenticated user:

- `getCurrentUser` in [convex/auth.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/convex/auth.ts)

That query calls `authComponent.getAuthUser(ctx)` and is useful once the client is using Convex directly.

## Files That Matter

Core auth files:

- [convex/auth.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/convex/auth.ts)
- [convex/http.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/convex/http.ts)
- [convex/auth.config.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/convex/auth.config.ts)
- [convex/convex.config.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/convex/convex.config.ts)
- [convex/lib/authEnv.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/convex/lib/authEnv.ts)

Docs shell:

- [src/index.tsx](/Users/pallepadehat/Documents/projects/school/cutandgo-api/src/index.tsx)

## Build Order For The Client

Recommended order:

1. Wire Better Auth sign-up, sign-in, sign-out, and session restore.
2. Add route protection and app bootstrap based on session state.
3. Create a thin domain API client for future `/api/v1` endpoints.
4. Add feature screens against mocked or temporary data until the REST routes are mounted.
5. Swap the mocks to real `/api/v1` calls as those routes land.

## Known Gaps

Right now this repo does not yet expose a complete domain REST API.

That means:

- The README can document auth accurately today
- The docs UI exists today
- The business API still needs to be finalized and mounted

If you want, the next useful step is for me to also add a `CLIENT_INTEGRATION.md` with ready-to-paste web client examples for login, signup, logout, and session restoration.
