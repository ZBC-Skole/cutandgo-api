# Cut&Go API

Cut&Go API er backend-grundlaget for booking, personale- og admin-flowet i Cut&Go.

Projektet er bygget med:

- `Hono` som offentligt HTTP API
- `Convex` som datalag og forretningslogik
- `Better Auth` til login og sessioner
- `Cloudflare Workers` som runtime

## Arkitektur

Vi bruger to backend-lag med hver deres ansvar:

- `Hono` eksponerer REST endpoints under `/api/v1`
- `Convex` ejer datamodel, relationer, validering og adgangskontrol

Det betyder i praksis:

1. En klient kalder et Hono endpoint som `POST /api/v1/salons/:salonId/bookings`
2. Hono læser auth-token fra `Authorization` header eller Better Auth cookie
3. Hono kalder den relevante Convex mutation/query
4. Convex validerer input, tjekker rolle/adgang og læser/skriver data

## Datamodel

Følgende kerneentiteter er defineret i [convex/schema.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/convex/schema.ts):

- `appUsers`
- `salons`
- `employees`
- `services`
- `bookings`
- `products`
- `openingHours`

Relationerne dækker blandt andet:

- en `salon` har mange `employees`
- en `salon` har mange `services`
- en `service` kan knyttes til flere `employees`
- en `booking` knytter `salon`, `client`, `employee` og `service` sammen
- `products` og `openingHours` knyttes til en `salon`, og åbningstid kan også knyttes til en specifik medarbejder

## Roller Og Adgang

Roller er defineret i [convex/domain.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/convex/domain.ts) og håndhæves i [convex/authz.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/convex/authz.ts).

Systemet bruger tre roller:

- `client`: kan arbejde med egne kunde-relevante flows som booking
- `staff`: kan administrere salondata inden for egen salon
- `admin`: kan administrere på tværs og tildele roller

Første bruger, der bootstrapper en profil, bliver automatisk `admin`. Senere brugere oprettes som `client`.

## Validering

Centrale felter valideres i [convex/domain.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/convex/domain.ts), fx:

- email
- telefonnummer
- slug
- prisfelter
- varigheder
- tidspunkter i `HH:MM`
- dato/tids-intervaller

## Kom I Gang

### 1. Installer dependencies

```bash
npm install
```

### 2. Start Convex

Hvis du arbejder lokalt, skal Convex køre og have genereret typer:

```bash
npx convex dev
```

### 3. Sæt nødvendige miljøvariabler

Appen forventer mindst:

- `CONVEX_URL`: URL til dit Convex deployment
- `SITE_URL`: frontend/site URL, fx `http://localhost:5173`
- `BETTER_AUTH_URL`: auth URL, fx `http://127.0.0.1:3211`

Hvis du bruger Wrangler/Cloudflare bindings, skal `CONVEX_URL` være tilgængelig i worker-miljøet.

### 4. Start appen

```bash
npm run dev
```

### 5. Byg til produktion

```bash
npm run build
```

### 6. Deploy

```bash
npm run deploy
```

### 7. Generér Cloudflare typer

```bash
npm run cf-typegen
```

## Hvor Finder Man Hvad?

- Hono entrypoint: [src/index.tsx](/Users/pallepadehat/Documents/projects/school/cutandgo-api/src/index.tsx)
- Convex/Hono integration: [src/lib/convex.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/src/lib/convex.ts)
- User routes: [src/routes/users.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/src/routes/users.ts)
- Salon routes: [src/routes/salons.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/src/routes/salons.ts)
- Booking routes: [src/routes/bookings.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/src/routes/bookings.ts)
- Convex foundation functions: [convex/core.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/convex/core.ts)

## Auth Og Brug Af API

Hono forsøger at finde Convex-tokenet på to måder:

- `Authorization: Bearer <token>`
- Better Auth cookie med Convex JWT

Hvis brugeren ikke er logget ind, vil beskyttede endpoints returnere `401`.
Hvis brugeren ikke har den rigtige rolle eller salonscope, returneres `403`.

## REST API Oversigt

Base path:

```txt
/api/v1
```

### Health

#### `GET /is-alive`

Bruges til simpel healthcheck.

Response:

```json
{
  "message": "I'm alive!"
}
```

### Users

#### `GET /users/me`

Returnerer viewer-kontekst:

- auth user
- app user
- tilknyttet salon
- tilknyttet employee

Kræver login og at brugerprofil findes.

#### `POST /users/me/bootstrap`

Opretter eller opdaterer den aktuelle app-brugerprofil.

Request body:

```json
{
  "phone": "+45 12 34 56 78"
}
```

Typisk første endpoint man kalder efter sign-up/sign-in.

#### `PATCH /users/:appUserId/role`

Tildeler rolle til en bruger.

Kræver `admin`.

Request body:

```json
{
  "role": "staff",
  "salonId": "k17...",
  "employeeId": "j57..."
}
```

### Salons

#### `GET /salons`

Returnerer aktive saloner.

#### `POST /salons`

Opretter en salon.

Kræver `admin`.

Request body:

```json
{
  "name": "Cut&Go Nørrebro",
  "slug": "cutandgo-norrebro",
  "description": "Vores salon på Nørrebro",
  "phone": "+45 12 34 56 78",
  "email": "norrebro@cutandgo.dk",
  "addressLine1": "Nørrebrogade 10",
  "postalCode": "2200",
  "city": "København N",
  "country": "DK",
  "timezone": "Europe/Copenhagen"
}
```

#### `GET /salons/:salonId/foundation`

Returnerer grunddata for en salon i ét kald:

- salon
- employees
- services
- openingHours
- products

Velegnet til admin- eller personale-UI, som skal loade basisopsætningen.

#### `POST /salons/:salonId/employees`

Opretter en medarbejder i en salon.

Kræver `staff` eller `admin` med adgang til salonen.

Request body:

```json
{
  "firstName": "Sanne",
  "lastName": "Jensen",
  "displayName": "Sanne",
  "role": "staff",
  "email": "sanne@cutandgo.dk",
  "phone": "+45 11 22 33 44",
  "bio": "Farve- og klippespecialist"
}
```

#### `POST /salons/:salonId/services`

Opretter en behandling/service.

Request body:

```json
{
  "name": "Dameklip",
  "description": "Klip og let styling",
  "durationMinutes": 45,
  "priceDkk": 499,
  "category": "klip",
  "employeeIds": ["j57...", "j58..."]
}
```

#### `POST /salons/:salonId/bookings`

Opretter en booking.

Kan bruges af `client` efter login.

Request body:

```json
{
  "employeeId": "j57...",
  "serviceId": "s91...",
  "startsAt": 1773651600000,
  "endsAt": 1773654300000,
  "notes": "Jeg vil gerne have pandehår trimmet",
  "customerName": "Palle Padehat",
  "customerEmail": "palle@example.com",
  "customerPhone": "+45 12 34 56 78"
}
```

#### `POST /salons/:salonId/products`

Opretter et produkt i salonens sortiment.

Request body:

```json
{
  "name": "Shampoo Volume",
  "brand": "Cut&Go Care",
  "description": "Volume shampoo til fint hår",
  "category": "haircare",
  "priceDkk": 199,
  "stockQuantity": 12,
  "sku": "VOL-SHAMPOO-250"
}
```

#### `POST /salons/:salonId/opening-hours`

Opretter åbningstid eller arbejdstid.

Request body:

```json
{
  "dayOfWeek": 1,
  "opensAt": "09:00",
  "closesAt": "17:30",
  "isClosed": false
}
```

`dayOfWeek` bruger:

- `0`: søndag
- `1`: mandag
- `2`: tirsdag
- `3`: onsdag
- `4`: torsdag
- `5`: fredag
- `6`: lørdag

### Bookings

#### `PATCH /bookings/:bookingId/status`

Opdaterer booking-status.

Kræver `staff` eller `admin` med adgang til salonen.

Request body:

```json
{
  "status": "confirmed"
}
```

Gyldige statuser:

- `pending`
- `confirmed`
- `completed`
- `cancelled`
- `no_show`

## Typisk Brugsscenarie

Et typisk setup-flow kan se sådan ud:

1. Bruger logger ind via Better Auth
2. Klienten kalder `POST /api/v1/users/me/bootstrap`
3. Første bruger bliver `admin`
4. Admin opretter salon via `POST /api/v1/salons`
5. Admin eller staff opretter medarbejdere, services, produkter og åbningstider
6. Client opretter booking via `POST /api/v1/salons/:salonId/bookings`
7. Staff bekræfter bookingen via `PATCH /api/v1/bookings/:bookingId/status`

## Fejlformat

API’et returnerer fejl på formen:

```json
{
  "error": "Human readable error message"
}
```

Typiske statuskoder:

- `400` ugyldigt input eller domæneregel brudt
- `401` ikke autentificeret
- `403` manglende rettigheder
- `404` resource ikke fundet
- `500` server- eller konfigurationsfejl

## Udvidelse Af API

Når nye endpoints skal bygges, er den anbefalede struktur:

1. Tilføj eller udvid Convex funktion i [convex/core.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/convex/core.ts) eller et nyt domænemodul
2. Genkør Convex codegen hvis nødvendigt
3. Tilføj Hono route i `src/routes/...`
4. Brug `createConvexClient()` fra [src/lib/convex.ts](/Users/pallepadehat/Documents/projects/school/cutandgo-api/src/lib/convex.ts)
5. Lad Convex eje forretningslogik og authz

Tommelfingerregel:

- Hono = transport og HTTP-kontrakt
- Convex = regler, relationer og data

## Verifikation

Følgende kommandoer er brugt til at verificere setup’et:

```bash
npx tsc --noEmit
npx tsc --noEmit -p convex/tsconfig.json
npm run build
```
