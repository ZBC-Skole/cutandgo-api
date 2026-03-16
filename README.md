# Cut&Go API

Cut&Go API er backend-grundlaget for booking, personale- og admin-flowet i Cut&Go.

Stack:

- `Hono` eksponerer REST API under `/api/v1`
- `Convex` ejer datamodel, queries og mutationer
- `Better Auth` leverer brugeridentitet til kunde/admin-flows
- `Cloudflare Workers` er runtime

## Hvad API'et Kan Nu

Booking-startflow:

- hente aktive saloner
- finde nærmeste salon ud fra `latitude` og `longitude`
- hente frisorer pr. salon
- hente behandlinger pr. salon eller pr. frisor
- beregne ledige tider ud fra abningstider, servicevarighed og eksisterende bookinger

Bookingflow:

- oprette booking med validering af salon, frisor, behandling og tidspunkt
- returnere bookingbekraftelse
- aflyse booking og frigive tiden igen
- beskytte mod dobbeltbookinger i Convex-mutationens atomiske flow

Admin-flow:

- oprette medarbejdere
- oprette og opdatere abningstider
- tilfoje produkter
- vedligeholde salonlokationer
- hente analytics pa salon- eller platformniveau

Personale-flow:

- validere login via `personalId`
- hente naeste kunde
- hente medarbejderens bookinger
- hente bookingdetaljer inkl. behandlingstype
- aflyse kommende bookinger ved sygdom

## Arkitektur

1. En klient kalder et Hono endpoint under `/api/v1`
2. Hono parser input og videresender til Convex
3. Convex validerer adgang, data og forretningsregler
4. Convex returnerer normaliserede data, som er klar til app-integration

Kernefiler:

- Hono entrypoint: [src/index.tsx](/Users/pallepadehat/Documents/projects/school/cutandgo-api/src/index.tsx)
- Convex/Hono integration: [src/lib/convex.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/src/lib/convex.ts)
- Salon routes: [src/routes/salons.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/src/routes/salons.ts)
- Booking routes: [src/routes/bookings.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/src/routes/bookings.ts)
- Admin routes: [src/routes/admin.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/src/routes/admin.ts)
- Staff routes: [src/routes/staff.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/src/routes/staff.ts)
- Convex business logic: [convex/core.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/convex/core.ts)
- Datamodel: [convex/schema.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/convex/schema.ts)

## Datamodel

Tabeller:

- `appUsers`
- `salons`
- `employees`
- `services`
- `bookings`
- `products`
- `openingHours`

Nye/noeglefelter:

- `salons.latitude` og `salons.longitude` til nearest-salon lookup
- `employees.personalId` til personale-login
- `bookings.cancellationReason` og `bookings.cancelledAt` til aflysning og sygdomsflow

## Roller Og Adgang

- `client`: kundeorienterede bookingflows
- `staff`: salonoperationer inden for egen salon
- `admin`: tvargaende administration og analytics

Auth:

- beskyttede kunde/admin-endpoints bruger `Authorization: Bearer <token>` eller Better Auth cookie
- personale-endpoints bruger `personalId` som validering

## Kom I Gang

### 1. Installer dependencies

```bash
npm install
```

### 2. Start Convex

```bash
npx convex dev
```

### 3. Miljovariabler

Projektet forventer mindst:

- `CONVEX_URL`
- `SITE_URL`
- `BETTER_AUTH_URL`

### 4. Start appen

```bash
npm run dev
```

### 5. Byg

```bash
npm run build
```

## REST API

Base path:

```txt
/api/v1
```

### Health

`GET /is-alive`

Returnerer:

```json
{
  "message": "I'm alive!"
}
```

### Users

`GET /users/me`

- returnerer viewer-kontekst for auth user, app user, salon og employee

`POST /users/me/bootstrap`

- opretter eller opdaterer app-brugerprofil

`PATCH /users/:appUserId/role`

- tildeler rolle og eventuelt salon/employee
- kraever `admin`

### Booking Startflow

`GET /salons`

- henter aktive saloner

`GET /salons/nearest?latitude=55.6761&longitude=12.5683`

- finder naermeste salon med lokationsdata

`GET /salons/:salonId/employees`

- henter aktive frisorer for en salon

`GET /salons/:salonId/services`

- henter aktive behandlinger for en salon

`GET /salons/:salonId/services?employeeId=<employeeId>`

- filtrerer behandlinger til en bestemt frisor

`GET /salons/:salonId/available-slots?employeeId=<employeeId>&serviceId=<serviceId>&startsAt=<unixMs>&days=3`

- beregner ledige tider ud fra abningstider, servicevarighed og eksisterende bookinger

### Bookingflow

`POST /salons/:salonId/bookings`

- opretter booking, hvis tiden stadig er ledig
- booking bliver valideret mod salon, medarbejder, service, varighed og overlap

Eksempel:

```json
{
  "employeeId": "j57...",
  "serviceId": "k83...",
  "startsAt": 1773651600000,
  "customerName": "Ada Lovelace",
  "customerEmail": "ada@example.com",
  "customerPhone": "+45 12 34 56 78",
  "notes": "Kort i siderne"
}
```

`GET /bookings/:bookingId/confirmation`

- returnerer booking med salon, frisor, service og bekræftelsesdata

`POST /bookings/:bookingId/cancel`

- aflyser booking og frigiver tiden igen

`PATCH /bookings/:bookingId/status`

- opdaterer status for personale/admin-flows

### Salon/Admin

`POST /salons`

- opretter salon
- kraever `admin`

`PATCH /salons/:salonId/location`

- opdaterer lokationsdata for salon

`POST /salons/:salonId/employees`

- opretter medarbejder og genererer `personalId`, hvis det ikke sendes med

`POST /salons/:salonId/services`

- opretter behandling/klipning

`POST /salons/:salonId/products`

- opretter produkt

`POST /salons/:salonId/opening-hours`

- opretter abningstid

`PATCH /salons/:salonId/opening-hours/:openingHoursId`

- opdaterer abningstid

`GET /salons/:salonId/analytics`

- returnerer salonanalytics for valgt periode

Der findes ogsa et dedikeret admin-namespace:

- `POST /admin/salons/:salonId/employees`
- `POST /admin/salons/:salonId/products`
- `POST /admin/salons/:salonId/opening-hours`
- `PATCH /admin/opening-hours/:openingHoursId`
- `PATCH /admin/salons/:salonId/location`
- `GET /admin/analytics`
- `GET /admin/salons/:salonId/analytics`

### Personale

`POST /staff/login`

- validerer medarbejder via `personalId`

Eksempel:

```json
{
  "personalId": "ADLO-42ABCD"
}
```

`GET /staff/:employeeId/next-customer?personalId=<personalId>`

- returnerer medarbejderens naeste kunde

`GET /staff/:employeeId/bookings?personalId=<personalId>&startsAt=<unixMs>&endsAt=<unixMs>`

- returnerer medarbejderens bookingoversigt

`GET /staff/bookings/:bookingId?personalId=<personalId>`

- returnerer bookingdetaljer inkl. behandlingstype

`POST /staff/:employeeId/sickness-cancellation`

- aflyser relevante bookinger i et tidsvindue ved sygdom

Eksempel:

```json
{
  "personalId": "ADLO-42ABCD",
  "startsAt": 1773651600000,
  "endsAt": 1773669600000,
  "reason": "Sygdom"
}
```

## Availability-logik

API'et beregner ledige tider ved at:

1. finde salonens eller medarbejderens gaeldende abningstid for dagen
2. omsaette lokal tid i salonens timezone til UTC timestamps
3. hente eksisterende bookinger for medarbejderen
4. generere slots i 15 minutters intervaller
5. fjerne slots, der overlapper aktive bookinger

Det betyder, at availability-responser er egnede som grundlag for senere app-integration.

## Verifikation

Foelgende er koert efter implementationen:

```bash
npx convex codegen
npm run build
npx tsc --noEmit
```
