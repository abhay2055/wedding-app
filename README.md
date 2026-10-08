# VivahSetu — Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5 + Phase 6

A pan-India wedding services marketplace. This repository currently
implements **Phase 1** (accounts, roles, authentication foundation),
**Phase 2** (a functional vendor marketplace: categories, vendor profiles,
portfolio, packages, search, wedding events, favorites, admin moderation),
**Phase 3** (vendor availability calendars and date-based vendor search),
**Phase 4** (booking requests with server-enforced availability/
double-booking protection, and real-time customer↔vendor messaging),
**Phase 5** (Razorpay advance payments, backend-verified booking
confirmation, platform commission accounting, and refunds), and **Phase 6**
(verified customer reviews with vendor rating aggregation, an in-app
notification system, and a full admin back office: customer management,
booking/payment oversight, review moderation, a real dashboard and basic
analytics).

> **Vendor payout automation, GST invoicing, subscriptions and the Swift
> iOS app are intentionally not implemented yet.** See
> [Future roadmap](#future-roadmap).

## Project overview

Customers can register, create a wedding/event, browse and filter vendors
(including by whether a vendor is available on their wedding date and by
minimum rating), view a vendor's portfolio, packages, availability calendar
and reviews, request a booking for a package, track its status, message the
vendor, pay the package's advance amount online (via Razorpay, or a
built-in dev stub when no real Razorpay account is configured) to confirm
the booking, and — once the vendor marks it completed — leave a verified
review. Customers get in-app notifications for booking/payment/review
events and can read them from a notification bell or a dedicated
notification center. Vendors can create a business profile, pick a
category, upload portfolio photos (or link a video), publish packages (each
with its own advance-payment percentage), manage their availability
calendar, accept/decline/manage booking requests, mark a confirmed booking
completed once its event date has passed, see what customers have paid
them (never any payment secret) and what customers have said about them
(every status, not just published), and get notified of all of the above.
Admins get a real dashboard (database-backed counts, not hardcoded
numbers), manage the category list, moderate vendors (verify/reject,
activate/deactivate) and customers (activate/deactivate), inspect
(read-only) all bookings and payments, issue full/partial refunds, moderate
reviews (publish/hide/reject), and view basic time-bucketed analytics.

Reviews and notifications are now implemented (see
[Reviews](#reviews) and [Notifications](#notifications)); vendor
payout/settlement automation, GST invoicing, subscription plans and a
Swift iOS app remain for a later phase — the schema and API are
deliberately shaped so those can be added without reworking what's here.
No booking is ever marked CONFIRMED except as a direct result of a
backend-verified, captured Razorpay payment, and no booking is ever marked
COMPLETED except by the vendor, after its event date has actually passed -
never from a frontend callback alone, and never faked. Only a completed
booking's customer can review it, and only a PUBLISHED review ever affects
a vendor's public rating.

## Architecture

- **frontend/** — React + TypeScript + Vite + Tailwind CSS single-page app.
- **backend/** — Node.js + TypeScript + Express REST API, versioned at `/api/v1`.
- **PostgreSQL + Prisma** — relational database and ORM/migrations.
- **docker-compose.yml** — local PostgreSQL for development and tests.

Backend request flow: `Route → Controller → Service → Repository (Prisma) → Database`.
Business logic lives in `services/`, not in route handlers or controllers.

Auth: short-lived JWT access tokens (sent in the `Authorization: Bearer`
header, held in memory on the frontend) plus a rotating refresh token stored
as an httpOnly cookie and hashed in the database (so a session can be revoked
server-side on logout, unlike a purely stateless JWT).

File uploads: vendor portfolio images go through a small `StorageProvider`
interface (`backend/src/utils/storage.ts`) with a local-disk implementation
for development. The rest of the app only talks to that interface, so
swapping in S3/Cloudinary later doesn't touch any calling code.

Date handling: every calendar-date field (`WeddingEvent.weddingDate`/`.endDate`,
`VendorAvailability.date`) is stored and compared as a UTC-midnight instant
for that specific calendar day - never a "local time" instant - and every
place that parses or formats one goes through `backend/src/utils/dateOnly.ts`
or the frontend's mirror at `frontend/src/utils/dateOnly.ts`, never through
`new Date(str).toLocaleDateString()`-style local-timezone conversion. That
pattern is exactly how a date can silently shift by a day depending on the
server's or viewer's timezone, which would be a real bug here: a customer's
wedding date has to compare *exactly* against a vendor's availability date.
`Booking.weddingDate`/`.eventEndDate` follow the same rule (and use
`@db.Date`, same as `VendorAvailability.date`).

Payments: a `PaymentProvider` interface (`backend/src/payments/types.ts`),
mirroring the same "interface + swappable implementation" shape as
`StorageProvider`, is implemented by `RazorpayPaymentProvider` (the real
Razorpay SDK) and, when no real Razorpay credentials are configured, an
in-memory `StubPaymentProvider` that uses the *exact same* HMAC-SHA256
signature verification code as the real provider - only the network calls
to Razorpay itself are simulated. See [Payments](#payments).

Real-time messaging: a small Socket.IO layer
(`backend/src/realtime/socket.ts`) sits alongside the REST API on the same
HTTP server. It authenticates a socket with the same JWT access token REST
uses, and its `message:send`/`conversation:read` handlers call the *exact
same* `messageService` functions the REST controllers call - REST remains
the single source of truth, and chat is 100% functional even if a client
(e.g. the future Swift app) never opens a socket at all. See
[Messaging](#messaging).

Reviews: `Vendor.averageRating`/`Vendor.reviewCount` are a denormalized
mirror of that vendor's PUBLISHED reviews, recomputed (never incrementally
patched) inside the same transaction as any review write - see
[Reviews](#reviews).

Notifications: one `notification.service.ts` is the single write path for
every in-app `Notification` row - booking/payment/message/review/vendor-
admin services call its named functions (the same hook-point pattern Phase
4/5 already used for the old console-only stub); no controller ever creates
a notification directly. See [Notifications](#notifications).

## Folder structure

```
backend/
  prisma/
    schema.prisma        # User, Vendor, VendorCategory, VendorPortfolio,
                          # VendorPackage(Item), WeddingEvent(Category),
                          # FavoriteVendor, VendorAvailability, AdminAuditLog,
                          # Booking, BookingCounter, Conversation, Message,
                          # Payment, PaymentAttempt, Commission,
                          # PaymentWebhookEvent, Review, Notification,
                          # RefreshToken + enums
    seed.ts               # dev seed data
  uploads/                # local-disk portfolio images (gitignored)
  src/
    config/               # env validation, Prisma client
    controllers/           # thin HTTP layer
    services/              # business logic (ownership checks, visibility rules,
                            # booking state machine, payment/commission/refund
                            # logic, review moderation + rating aggregation,
                            # notification hook points, admin dashboard/analytics)
    repositories/          # Prisma data access
    middleware/            # auth, role, validation, upload, rate limit, error handling
    routes/                 # /api/v1/* route wiring
    validators/             # zod request schemas
    utils/                  # ApiError, ApiResponse, jwt, password, slug, storage,
                             # dateOnly, sanitize (strips HTML from user-generated text)
    payments/                # PaymentProvider interface + Razorpay/stub implementations,
                              # shared HMAC signature helpers (see Payments below)
    realtime/socket.ts      # Socket.IO layer - thin wrapper over the message service
    app.ts / server.ts
  tests/                    # jest + supertest

frontend/
  src/
    api/                    # axios client + typed API calls, one module per resource
                             # (payments.ts, devPayments.ts for the stub-only flow,
                             # reviews.ts, notifications.ts)
    components/             # Button, Input, Card, VendorCard, Pagination, Tabs,
                             # AvailabilityCalendar, VendorAvailabilityManager,
                             # BookingStatusBadge, PaymentStatusBadge,
                             # PayAdvanceButton, StarRating, ReviewCard,
                             # RatingSummary, ReviewForm, ReviewStatusBadge,
                             # NotificationBell, etc.
    context/AuthContext.tsx # auth state, silent refresh on load
    hooks/                  # useCategories, useFavorites, useConversationSocket,
                             # useUnreadMessageCount, useUnreadNotificationCount
    pages/                  # Home, Login, Register, Dashboard, vendor marketplace,
                             # wedding setup, vendor dashboard, booking request/
                             # detail, messages, payment history, reviews,
                             # notification center, admin pages (vendors,
                             # customers, bookings, payments, reviews, categories,
                             # analytics)
    realtime/socket.ts       # socket.io-client singleton (real-time message events only -
                              # sending/reading always goes through the REST api/ modules)
    routes/ProtectedRoute.tsx
    utils/dateOnly.ts        # timezone-safe date parsing/formatting/calendar-grid helpers
    utils/razorpay.ts        # lazy-loads Razorpay Checkout's script, opens it
    utils/notificationTarget.ts # maps a notification's entityType + viewer role to
                                 # where clicking it should navigate

docker-compose.yml           # local Postgres (dev + test databases)
scripts/init-test-db.sql     # creates the test database on first container start
```

## Requirements

- Node.js 20+ (developed on Node 24)
- Docker (for local PostgreSQL) — or your own PostgreSQL 14+ instance
- npm

## Environment setup

Backend:

```bash
cd backend
cp .env.example .env
# generate strong secrets, e.g.:
#   openssl rand -hex 48
# and paste them into JWT_ACCESS_SECRET / JWT_REFRESH_SECRET in .env
```

`.env.example` ships with `RAZORPAY_KEY_ID` set to the sentinel value
`rzp_test_stub_dev_only`, which makes the backend use an in-memory stub
payment provider instead of talking to Razorpay - so the app runs and the
full payment flow works out of the box with zero external accounts. To use
real Razorpay Test Mode credentials instead, see
[Razorpay setup](#razorpay-setup).

`.env.example` also ships `REVIEW_AUTO_PUBLISH=false` - a new review starts
`PENDING` and only becomes public once an admin publishes it. Set it to
`true` for a deployment that doesn't want review moderation at all (new/
edited reviews go straight to `PUBLISHED`). See [Reviews](#reviews).

Frontend:

```bash
cd frontend
cp .env.example .env
```

`.env` files are gitignored and must never be committed.

## Database setup

Start PostgreSQL (creates both a dev and a test database):

```bash
docker compose up -d postgres
```

This starts one Postgres container with two databases: `wedding_app` (dev)
and `wedding_app_test` (tests), matching the defaults in
`backend/.env.example` / `backend/.env.test.example`.

## Migration commands

```bash
cd backend
npm install
npm run prisma:generate      # generate Prisma client
npm run prisma:migrate       # create/apply migrations against DATABASE_URL (dev)
npm run prisma:migrate:deploy  # apply existing migrations without prompting (CI/test)
npm run prisma:studio        # optional: browse the database
```

## Seed commands

```bash
cd backend
npm run seed
```

Re-running the seed script always resets demo data to the same known-good
state (see [Development test accounts](#development-test-accounts)):

- 1 admin, 2 customers (untouched if they already exist)
- 15 vendor categories
- 20 demo vendors spread across every category and several Indian cities,
  each with 2 packages (with items) and 2-3 portfolio images (one also has a
  video). Verification status is deliberately mixed: 14 `VERIFIED`, 4
  `PENDING`, 2 `REJECTED`, so the admin UI and marketplace visibility rules
  can both be exercised
- 1 demo wedding event for `customer@example.test`, a 3-day event
  (15-17 Feb 2027)
- Demo availability data lined up with that wedding date so the "available
  on my wedding date" flow has real examples to find: a vendor available on
  all 3 days of the event, a vendor available only on the single wedding
  date, a vendor explicitly unavailable that day, a vendor with a `BLOCKED`
  date (with a private note, to verify it's never exposed publicly), and a
  vendor with **no** availability record at all (the "unknown, not yet
  updated" case, which the availability filter must never treat as
  available)
- 10 demo bookings for `customer@example.test`: 3 `PENDING`, 1 `ACCEPTED`,
  1 `CONFIRMED` (the `demo-photographer1` booking, which claimed the full
  3-day event range - see the `demo-photographer1` availability above, now
  flipped to `BOOKED` for those dates - and has a matching `CAPTURED`
  payment + commission below), 1 `DECLINED`, 1 `CANCELLED`, and 3
  `COMPLETED` (written directly as `COMPLETED` rather than played through
  the real accept/pay/complete flow, purely so there's something to hang a
  demo review off of - see the next bullet)
- 2 demo payments (clearly fictional - see each row's `metadata`, never
  presented as a real financial transaction): a `CAPTURED` advance payment
  with its `Commission` row for the `demo-photographer1` booking above, and
  a `FAILED` advance attempt for the `demo-decor1` `ACCEPTED` booking (which
  stays payable - see [Payments](#payments) - so the "pay advance" flow has
  a real ACCEPTED-but-unpaid booking to exercise interactively)
- 3 demo reviews (clearly fictional), one per `COMPLETED` booking above,
  spanning every moderation state that matters: 1 `PUBLISHED` (5★, for
  `demo-caterer1` - its `averageRating`/`reviewCount` are updated to match,
  exactly as `recalculateVendorRating` would), 1 `PENDING` (4★, for
  `demo-venue1` - awaiting moderation, so the admin review queue has
  something real in it), 1 `REJECTED` (1★, for `demo-dj1` - demonstrates a
  moderation decision that already happened)
- 3 demo notifications (2 for `customer@example.test` - one already read,
  one still unread, so the bell badge has something to show - and 1 for
  `demo-caterer1`'s vendor account, matching the `REVIEW_RECEIVED` its
  published review would really have triggered)
- 2 demo `AdminAuditLog` rows matching what verifying `demo-caterer1` and
  rejecting `demo-venue2` through the real admin API would have recorded
- 2 demo conversations (one linked to a pending booking, one to an accepted
  one) with a short back-and-forth, including unread state, so the
  messaging UI has something real to show

None of the seeded vendors, bookings, payments, reviews, notifications or
conversations are real.

## Development commands

Backend (http://localhost:4000):

```bash
cd backend
npm install
npm run dev
```

Frontend (http://localhost:5173):

```bash
cd frontend
npm install
npm run dev
```

Both need `docker compose up -d postgres` running first, and the backend
needs migrations + seed to have been run at least once.

## Test commands

```bash
cd backend
cp .env.test.example .env.test   # once
npx dotenv -e .env.test -- npx prisma migrate deploy   # once, or after schema changes
npm test
```

Tests run against `wedding_app_test`, never the dev database, and every rate
limiter in the app is skipped under `NODE_ENV=test` (the suite legitimately
makes far more requests than the production limits allow). `.env.test` sets
`RAZORPAY_KEY_ID` to the same stub sentinel as dev, so payment tests exercise
the full real signature-verification/webhook code path with zero network
calls. 205 tests cover:

- Phase 1: registration, login, invalid credentials, duplicate email,
  password hashing, unauthenticated access, cross-role authorization,
  `GET/PATCH /users/me`.
- Phase 2: vendor profile create/update (slug generation, slug stability,
  category validation, verification/eventsCompleted not client-writable),
  public vendor profile (by id and by slug, field exposure, 404 for
  rejected/inactive), vendor search (category/city/price/verified filters,
  pagination limits, sort, rejected vendors never returned), categories API,
  vendor packages (creation, negative-price rejection, cross-vendor IDOR on
  read/edit/delete), vendor portfolio (image-without-file and
  video-without-url rejected, cross-vendor IDOR on delete), wedding events
  (creation, category join table, guest/budget/date validation, cross-customer
  IDOR), favorites (add/remove, duplicate-favorite prevention, auth
  requirements), admin category management (create/update/deactivate), admin
  vendor management (list/get/verify/activate, self-verification blocked,
  non-admin blocked).
- Phase 3: availability create/update/delete, upsert-not-duplicate on the
  same (vendor, date), cross-vendor IDOR on edit/delete, invalid/past-date
  rejection, bulk range set (and its max-range rejection), public
  availability endpoint (notes never exposed, oversized range rejected),
  `availableOn` search filtering (AVAILABLE included; UNAVAILABLE, BLOCKED,
  and **no record at all** all excluded - "unknown" is never "available"),
  combined city+category+date filtering, multi-day `availableFrom`/
  `availableTo` filtering (must be AVAILABLE on *every* day in the range,
  and stops qualifying the moment one day changes to BLOCKED), admin
  availability view/correction with an audit-log entry, and every relevant
  authorization boundary (VENDOR-only, ADMIN-only, unauthenticated).
- Phase 4: booking creation (snapshotting package details, server-controlled
  `totalAmount` ignoring any client-supplied price, unique sequential
  `bookingNumber`s including under concurrent requests), availability
  re-validation (rejects `UNAVAILABLE`/`BLOCKED`/no-record dates, validates
  every day of a multi-day request), cross-customer IDOR on create/read/
  cancel, package-must-belong-to-vendor, accept/decline (cross-vendor IDOR,
  invalid-transition rejection, e.g. `DECLINED → ACCEPTED`), the
  double-booking guard itself (two customers can both request the same date;
  once the vendor accepts one, accepting the conflicting one now fails with
  409 and the first booking's dates are provably `BOOKED`), cancellation
  reopening a vendor's availability, admin read-only booking list;
  conversations (customer-initiated get-or-create with dedup, booking-scoped
  get-or-create inferring both parties from the booking, cross-user/
  cross-vendor IDOR), messages (send, empty-body rejection, pagination,
  unread-count tracking, mark-as-read, IDOR on send/read for a conversation
  the sender isn't part of).
- Phase 5: payment order creation (correct amount from the booking's
  snapshotted advance, client-supplied `amount` ignored, idempotent reuse of
  an in-flight order, rejected for a non-`ACCEPTED` booking or a 0%-advance
  package, cross-customer IDOR), payment verification (valid signature
  captures the payment and confirms the booking with the correct commission
  amounts, invalid signature fails the payment without confirming the
  booking, tampered/mismatched amount rejected, idempotent on a second
  verify call, cross-customer IDOR, unknown order id), the Razorpay webhook
  (valid `payment.captured`/`payment.failed` processed correctly, invalid or
  missing signature rejected, malformed payload rejected, **redelivered
  event id is not reprocessed** - one webhook-events row, one commission,
  webhook-vs-REST-verify race does not double-apply a capture, unrecognized
  event types safely ignored), payment reads (customer/vendor/admin
  visibility and IDOR boundaries, `providerSignature` never present in any
  response), refunds (full, partial leaving `paymentStatus: PAID` rather
  than `REFUNDED`, over-refund rejected, refunding a non-captured payment
  rejected, non-admin blocked), and the dev-only simulation routes.
- Phase 6: reviews (eligible customer can review a `COMPLETED` booking;
  `PENDING`/`ACCEPTED` bookings rejected with `BOOKING_NOT_COMPLETED`;
  cross-customer IDOR on create/edit/delete; duplicate review on the same
  booking rejected; rating/comment-length validation; stored-HTML
  stripped from title/comment; edit resets a review to `PENDING`;
  `PUBLISHED` reviews affect the vendor's `averageRating`/`reviewCount`
  aggregate exactly, `HIDDEN`/`REJECTED` ones don't; the aggregate is
  correct across multiple published reviews; public vendor-reviews endpoint
  returns `PUBLISHED` only with a correct summary/distribution and never
  leaks the reviewer's email/phone; the vendor's-own and customer's-own
  "every status" endpoints each show only the caller's own reviews; admin
  moderation list/filter and publish/hide/reject, non-admin blocked);
  booking completion (`EVENT_NOT_YET_OCCURRED` before the event date,
  `INVALID_STATUS_TRANSITION` from a non-`CONFIRMED` booking, cross-vendor
  IDOR); vendor search by rating (`minRating` filter, `sort=rating`
  ordering); notifications (booking created/accepted/cancelled-notifies-
  the-other-party-only/completed, message notifies the recipient only,
  review received/published, vendor verification/activation, unread-count
  tracking, mark-one-read, mark-all-read, unread-only filtering,
  IDOR on read/mark-read/delete, unauthenticated rejected); admin
  (customer list/filter never leaks `passwordHash`, never includes vendors,
  activate/deactivate with an audit-log entry, vendor-verification
  audit-log entry, dashboard returns real non-zero database-backed counts,
  analytics returns time-bucketed data for every supported range and
  rejects an invalid range, every admin surface rejects unauthenticated/
  customer/vendor callers with 401/403).

Frontend:

```bash
cd frontend
npm run typecheck
npm run lint
npm run build
```

## API endpoints

All endpoints are versioned under `/api/v1`. Responses follow a consistent
envelope: `{ "success": true, "data": {...} }` or
`{ "success": false, "error": { "code", "message" } }`.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | none | Register a new **CUSTOMER** account (role cannot be chosen by the caller) |
| POST | `/auth/login` | none | Log in, returns access token + sets refresh cookie |
| POST | `/auth/refresh` | refresh cookie | Rotates refresh token, returns a new access token |
| POST | `/auth/logout` | refresh cookie | Revokes the current refresh token |

### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users/me` | any authenticated user | Current user's profile |
| PATCH | `/users/me` | any authenticated user | Update `name`/`phone` (not email/role) |

### Categories

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/categories` | none | Active categories, for filters/pickers |

### Vendors (public)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/vendors` | none | Search/filter vendors — see query params below |
| GET | `/vendors/:id` | none | Public vendor profile by id |
| GET | `/vendors/slug/:slug` | none | Public vendor profile by SEO-friendly slug (used by `/vendors/:slug` on the frontend) |

`GET /vendors` query params: `category` (slug), `city`, `locality`,
`minPrice`, `maxPrice`, `verified` (`true`/`false`), `search`, `minRating`
(1-5, filters on `Vendor.averageRating`), `page` (default 1), `limit`
(default 20, max 100), `sort`
(`relevance` | `price_asc` | `price_desc` | `newest` | `most_events` | `rating`
— an unsupported value is a 400, not a silent fallback), plus the Phase 3
date filters below. Filtering, sorting and pagination all happen in the
database query, not in application code. `relevance` (the default) factors
in rating too now, but isn't rating-only - verification status still comes
first (see [Vendor search](#vendor-search-1) under Reviews for the reasoning).
Example: `GET /vendors?city=Jalandhar&category=photography&verified=true&minRating=4&sort=rating`.

Only active vendors that aren't `REJECTED` are ever visible publicly
(`PENDING` vendors are visible but not prioritized; see
`publicVendorWhere` in `backend/src/repositories/vendor.repository.ts` —
this rule is centralized there, not decided per-caller or on the frontend).

**Date filters** (see [Availability model](#availability-model) for what
"available" means):

- `availableOn=YYYY-MM-DD` — only vendors with an explicit `AVAILABLE`
  record for that exact date. A vendor with no record for the date, or an
  `UNAVAILABLE`/`BLOCKED` one, is excluded — "no record" is never treated as
  available. Example: `GET /vendors?availableOn=2027-02-15`.
- `availableFrom=YYYY-MM-DD&availableTo=YYYY-MM-DD` — only vendors
  `AVAILABLE` on **every** date in that range (for multi-day events).
  Resolved as a single grouped SQL query
  (`findVendorIdsAvailableForRange` in `vendor.repository.ts`:
  `COUNT(DISTINCT date) >= dayCount` per vendor), not a loop over vendors in
  application code. Example:
  `GET /vendors?availableFrom=2027-02-15&availableTo=2027-02-17`.
- `availableOn` cannot be combined with `availableFrom`/`availableTo`;
  `availableFrom` and `availableTo` must be provided together; the range is
  capped at 60 days (`MAX_SEARCH_DATE_RANGE_DAYS` in
  `backend/src/utils/dateOnly.ts`) — all enforced by the validator (400, not
  a silent fallback).
- Combines with every other filter, e.g.
  `GET /vendors?city=Jalandhar&category=photography&availableOn=2027-02-15`.

### Vendors (authenticated vendor - own profile)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/vendors/me` | VENDOR | Own vendor business profile |
| POST | `/vendors/me` | VENDOR | Create own vendor business profile (generates a unique slug; `verificationStatus` always starts `PENDING`) |
| PATCH | `/vendors/me` | VENDOR | Update own vendor business profile (slug is preserved even if `businessName` changes, so existing links don't break; `verificationStatus`/`eventsCompleted` are not accepted here) |

### Vendor portfolio (authenticated vendor - own portfolio)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/vendors/me/portfolio` | VENDOR | List own portfolio items |
| POST | `/vendors/me/portfolio` | VENDOR | Add an item — `multipart/form-data` with `type=IMAGE` and a `file` (JPEG/PNG/WEBP, ≤5MB), or JSON `{ type: "VIDEO", url }` |
| PATCH | `/vendors/me/portfolio/:id` | VENDOR | Update title/description/sortOrder/url (own item only — 404 for another vendor's item) |
| DELETE | `/vendors/me/portfolio/:id` | VENDOR | Delete own item (own item only) |

### Vendor packages (authenticated vendor - own packages)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/vendors/me/packages` | VENDOR | List own packages with items |
| POST | `/vendors/me/packages` | VENDOR | Create a package (`name`, `price`, optional `advancePercentage` [0-100, default 20], optional `items[]`) |
| GET | `/vendors/me/packages/:id` | VENDOR | Get one own package (404 for another vendor's) |
| PATCH | `/vendors/me/packages/:id` | VENDOR | Update a package (own only; passing `items` replaces the item list) |
| DELETE | `/vendors/me/packages/:id` | VENDOR | Delete a package (own only) |

`advancePercentage` is snapshotted onto `Booking.advanceAmount` the moment a
booking is created from that package (see [Payments](#payments)) — changing
a package's percentage later never changes what an already-created booking
owes.

### Vendor availability

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/vendors/me/availability` | VENDOR | List own availability, optionally `?from=&to=` (range capped at 366 days) |
| POST | `/vendors/me/availability` | VENDOR | Set one date's status — `{ date, status, note? }`. **Upserts**: setting an already-set date updates it in place (same id) rather than erroring, matching "click a date, change its status" in the UI. `status` is `AVAILABLE`\|`UNAVAILABLE`\|`BLOCKED` only (never `BOOKED` — see [Availability model](#availability-model)). Past dates are rejected. |
| POST | `/vendors/me/availability/bulk` | VENDOR | Set a whole date range in one request — `{ startDate, endDate, status, note? }`, `startDate` ≤ `endDate`, range capped at 366 days. One HTTP request either way; internally a single Prisma transaction of per-day upserts, not N frontend requests. |
| PATCH | `/vendors/me/availability/:id` | VENDOR | Update status/note on an existing record (own only — 404 for another vendor's) |
| DELETE | `/vendors/me/availability/:id` | VENDOR | Delete a record, reverting that date to "not updated" |
| GET | `/vendors/:id/availability` | none | Public read: `?from=&to=` (range capped at 60 days), returns `[{ date, status }]` only — never `note`, `id` or `vendorId` |

### Bookings (authenticated customer)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/bookings` | CUSTOMER | Request a booking — `{ vendorId, eventId, packageId, weddingDate, eventEndDate?, guestCount?, customerNotes? }`. Re-validates everything server-side (vendor eligible, package belongs to vendor, event belongs to caller, every required date is explicitly `AVAILABLE`) inside one transaction; `totalAmount` always comes from the package's current price — there is no price field in the request body to override. 409 (`VENDOR_NOT_AVAILABLE`) if any date isn't available. Rate-limited (20/min) alongside the other write-heavy endpoints. |
| GET | `/bookings` | CUSTOMER | List own bookings — `?status=&page=&limit=` |
| GET | `/bookings/:id` | CUSTOMER | Get one own booking (404 for another customer's) |
| PATCH | `/bookings/:id/cancel` | CUSTOMER | Cancel own booking if `PENDING` or `ACCEPTED` (409 `INVALID_STATUS_TRANSITION` otherwise). Cancelling an `ACCEPTED` booking reopens the vendor's availability for those dates. |
| POST | `/bookings/:bookingId/payment/order` | CUSTOMER | Create (or reuse an in-flight) Razorpay order for this booking's advance — see [Payments](#payments) |
| POST | `/bookings/:bookingId/review` | CUSTOMER | Leave a review — only once this booking is `COMPLETED` — see [Reviews](#reviews) |

### Bookings (authenticated vendor - own bookings)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/vendors/me/bookings` | VENDOR | List own bookings — `?status=&page=&limit=` |
| GET | `/vendors/me/bookings/:id` | VENDOR | Get one own booking, including the customer's contact info (404 for another vendor's) |
| PATCH | `/vendors/me/bookings/:id/accept` | VENDOR | Accept a `PENDING` booking. Atomically flips every required date's `VendorAvailability` from `AVAILABLE` to `BOOKED` inside a transaction — **this is the double-booking guard**, see [Double-booking foundation](#double-booking-foundation). 409 if any date is no longer available (another booking claimed it first). |
| PATCH | `/vendors/me/bookings/:id/decline` | VENDOR | Decline a `PENDING` booking (optional `vendorNotes`) |
| PATCH | `/vendors/me/bookings/:id/cancel` | VENDOR | Cancel own booking if `PENDING` or `ACCEPTED` — same reopen-availability behavior as the customer endpoint |
| PATCH | `/vendors/me/bookings/:id/complete` | VENDOR | Mark a `CONFIRMED` booking `COMPLETED` — only once its event date has passed (409 `EVENT_NOT_YET_OCCURRED` otherwise). This is what makes the booking's customer eligible to review the vendor — see [Booking state machine](#booking-state-machine) and [Reviews](#reviews). |

Example request:

```json
POST /api/v1/bookings
{
  "vendorId": "5b6b...",
  "eventId": "9a12...",
  "packageId": "c410...",
  "weddingDate": "2027-02-15",
  "eventEndDate": "2027-02-17",
  "guestCount": 250,
  "customerNotes": "Please call before confirming"
}
```

### Payments

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/bookings/:bookingId/payment/order` | CUSTOMER | Create (or reuse) a Razorpay order for this booking's advance (see the Bookings table above) |
| POST | `/payments/verify` | CUSTOMER | Verify a completed checkout — `{ providerOrderId, providerPaymentId, providerSignature }`. Backend re-verifies the signature *and* re-fetches the payment from Razorpay before trusting it — see [Payments](#payments) |
| GET | `/payments` | CUSTOMER | List own payments — `?status=&page=&limit=` |
| GET | `/payments/:id` | CUSTOMER or VENDOR | Get one payment (customer owner, or the booking's vendor — 404, not 403, for anyone else) |
| GET | `/vendors/me/payments` | VENDOR | List payments on own bookings (read-only — no provider secret ever included) |
| GET | `/admin/payments` | ADMIN | List all payments — `?status=&vendorId=&customerId=&bookingId=&page=&limit=` |
| POST | `/admin/payments/:id/refund` | ADMIN | Full or partial refund — `{ amount?, reason? }` (omit `amount` for a full refund of whatever remains unrefunded) |
| POST | `/payments/webhook/razorpay` | Razorpay signature (`X-Razorpay-Signature`), not a user | Razorpay's server-to-server webhook — see [Payments](#payments) |
| POST | `/dev/payments/simulate-checkout` | none — **only exists** when the stub provider is active | Simulates a completed checkout for a given `providerOrderId`, returning a real (stub-secret-signed) `{ providerPaymentId, providerSignature }` pair to feed into `/payments/verify` |
| POST | `/dev/payments/simulate-webhook` | none — **only exists** when the stub provider is active | Builds a correctly-signed simulated webhook body, for exercising `/payments/webhook/razorpay` end to end |

Example request/response:

```json
POST /api/v1/bookings/9a12.../payment/order
→ 201
{
  "success": true,
  "data": {
    "order": {
      "paymentId": "2b65e185-...",
      "providerOrderId": "order_...",
      "amount": 12000,
      "currency": "INR",
      "razorpayKeyId": "rzp_test_...",
      "bookingNumber": "BOOK-2026-000001"
    }
  }
}
```

`amount` and `razorpayKeyId` (Razorpay's *public* key id, safe to expose to
a browser) are the only things Razorpay Checkout needs to open. The request
body accepts nothing that could change the amount — it's always read from
`Booking.advanceAmount`, server-side.

### Reviews

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/bookings/:bookingId/review` | CUSTOMER | Leave a review — `{ rating, title?, comment }`. Only once the booking is `COMPLETED` and belongs to the caller (see the Bookings table above) |
| GET | `/reviews` | CUSTOMER | List **own** reviews, every status — `?page=&limit=` |
| GET | `/reviews/:id` | CUSTOMER, VENDOR or ADMIN | A `PUBLISHED` review is visible to any authenticated caller; a non-published one only to its author, the reviewed vendor's own account, or an admin (404 otherwise) |
| PATCH | `/reviews/:id` | CUSTOMER | Edit own review — only while `PENDING`/`PUBLISHED` (409 `REVIEW_NOT_EDITABLE` otherwise). Re-enters moderation (`PENDING`) unless `REVIEW_AUTO_PUBLISH=true` |
| DELETE | `/reviews/:id` | CUSTOMER | Delete own review (any status) — recomputes the vendor's rating aggregate |
| GET | `/vendors/:vendorId/reviews` | none | Public: `PUBLISHED` reviews only, paginated, plus a `summary` (`averageRating`, `reviewCount`, star `distribution`) |
| GET | `/vendors/me/reviews` | VENDOR | Own reviews, every status (not just published) — `?page=&limit=` |
| GET | `/admin/reviews` | ADMIN | See the Admin table above |
| PATCH | `/admin/reviews/:id/status` | ADMIN | See the Admin table above |

See [Reviews](#reviews) for the eligibility rule, moderation, editing
behavior and rating aggregation.

### Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/notifications` | any authenticated role | List own notifications, newest first — `?unreadOnly=true&page=&limit=` |
| GET | `/notifications/unread-count` | any authenticated role | `{ count }` — indexed on `[userId, isRead]`, cheap even at scale |
| PATCH | `/notifications/:id/read` | any authenticated role | Mark one notification read (404 for another user's — see [Notifications](#notifications)) |
| PATCH | `/notifications/read-all` | any authenticated role | Mark every one of the caller's notifications read |
| DELETE | `/notifications/:id` | any authenticated role | Delete own notification (404 for another user's) |

### Conversations & messages (authenticated customer or vendor)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/conversations` | CUSTOMER or VENDOR | List own conversations, newest-active first, each with an `_count.messages` unread count *for the caller* |
| POST | `/conversations` | CUSTOMER or VENDOR | Get-or-create a conversation — `{ vendorId }` (CUSTOMER-only: a pre-booking inquiry) or `{ bookingId }` (either party: both customer/vendor ids are inferred from the booking, so neither side names the other directly). Reuses the existing thread for that (customer, vendor) pair rather than creating a duplicate — see `@@unique([customerId, vendorId])` on `Conversation`. |
| GET | `/conversations/:id` | CUSTOMER or VENDOR | Get one conversation (404 if the caller isn't a participant) |
| GET | `/conversations/:id/messages` | CUSTOMER or VENDOR | Paginated messages, oldest-first — `?page=&limit=` (default 50, max 100) |
| POST | `/conversations/:id/messages` | CUSTOMER or VENDOR | Send a message — `{ body }` (1-4000 chars; empty rejected) |
| PATCH | `/conversations/:id/read` | CUSTOMER or VENDOR | Mark every message *not sent by the caller* as read |

### Wedding events (authenticated customer)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/events` | CUSTOMER | List own wedding events |
| POST | `/events` | CUSTOMER | Create an event (`name`, `city`, `weddingDate` required; `endDate` ≥ `weddingDate`; `budgetMax` ≥ `budgetMin`; `guestCount` ≥ 1; optional `categoryIds[]` for interested services) |
| GET | `/events/:id` | CUSTOMER | Get one own event (404 for another customer's) |
| PATCH | `/events/:id` | CUSTOMER | Update own event |
| DELETE | `/events/:id` | CUSTOMER | Delete own event |

### Favorites (authenticated customer)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/favorites` | CUSTOMER | List saved vendors |
| POST | `/favorites/:vendorId` | CUSTOMER | Save a vendor (idempotent — favoriting twice doesn't duplicate) |
| DELETE | `/favorites/:vendorId` | CUSTOMER | Un-save a vendor |

### Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/me` | ADMIN | Admin foundation placeholder |
| GET | `/admin/dashboard` | ADMIN | Real database-backed summary counts — see [Admin dashboard](#admin-dashboard) |
| GET | `/admin/analytics` | ADMIN | Time-bucketed analytics — `?range=7d\|30d\|90d\|1y` — see [Admin analytics](#admin-analytics) |
| GET | `/admin/categories` | ADMIN | All categories (active + inactive) with vendor counts |
| POST | `/admin/categories` | ADMIN | Create a category |
| PATCH | `/admin/categories/:id` | ADMIN | Update a category (name/description/isActive) |
| DELETE | `/admin/categories/:id` | ADMIN | **Soft** deactivation (`isActive: false`) — never a destructive delete, so vendors keep their `categoryId` |
| GET | `/admin/vendors` | ADMIN | List vendors, filterable by `verificationStatus`/`isActive`/`search`, paginated |
| GET | `/admin/vendors/:id` | ADMIN | Full vendor detail (includes owner's name/email/phone) |
| PATCH | `/admin/vendors/:id/verify` | ADMIN | Set `verificationStatus` to `VERIFIED`/`REJECTED`/`PENDING` — a vendor can never call this on itself. Recorded to `AdminAuditLog` (`VENDOR_VERIFIED`/`VENDOR_REJECTED`/`VENDOR_PENDING`) and notifies the vendor (Phase 6). |
| PATCH | `/admin/vendors/:id/status` | ADMIN | Activate/deactivate a vendor (`isActive`). Recorded to `AdminAuditLog` (`VENDOR_ACTIVATED`/`VENDOR_DEACTIVATED`) and notifies the vendor (Phase 6). |
| GET | `/admin/vendors/:id/availability` | ADMIN | Full availability for a vendor (support/debugging) — **includes** private notes, unlike the public endpoint |
| PATCH | `/admin/vendors/:id/availability/:date` | ADMIN | Correct a vendor's status for one date. Accepts the full status enum (including `BOOKED`, for correcting a bad automated write, e.g. from a booking acceptance). Every call is recorded to `AdminAuditLog` — see [Audit log](#audit-log) |
| GET | `/admin/customers` | ADMIN | List customers (role `CUSTOMER` only), filterable by `isActive`/`search`, paginated — see [Admin customer management](#admin-customer-management) |
| PATCH | `/admin/customers/:id/status` | ADMIN | Activate/deactivate a customer (`isActive`). Recorded to `AdminAuditLog` (`CUSTOMER_ACTIVATED`/`CUSTOMER_DEACTIVATED`). Never returns `passwordHash`. |
| GET | `/admin/bookings` | ADMIN | **Read-only** - list all bookings, filterable by `status`/`vendorId`/`customerId`/`from`/`to` (wedding date range), paginated |
| GET | `/admin/payments` | ADMIN | See [Payments](#payments) |
| POST | `/admin/payments/:id/refund` | ADMIN | See [Payments](#payments) |
| GET | `/admin/reviews` | ADMIN | List reviews, filterable by `status`/`vendorId`/`customerId`, paginated — see [Review moderation](#review-moderation) |
| PATCH | `/admin/reviews/:id/status` | ADMIN | Publish/hide/reject a review (`{ status }`) — recomputes the vendor's rating aggregate and notifies the customer (publish/reject only) |

### Misc

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | none | Liveness check (unversioned) |
| GET | `/uploads/portfolio/*` | none | Static vendor portfolio images (local-disk storage) |

## Availability model

`VendorAvailability` is one row per `(vendorId, date)` — enforced by a
`@@unique([vendorId, date])` constraint, so a vendor can never have two
conflicting records for the same day. `status` is one of:

- **`AVAILABLE`** — vendor confirmed they're available.
- **`UNAVAILABLE`** — vendor confirmed they're *not* available.
- **`BLOCKED`** — vendor manually blocked the date (e.g. a personal event),
  optionally with a private `note`.
- **`BOOKED`** — set only by `booking.service.acceptBooking` (see
  [Double-booking foundation](#double-booking-foundation)) when a vendor
  accepts a booking request. The vendor-facing availability API still
  rejects setting it directly (only the booking-acceptance flow, and the
  admin correction endpoint for fixing mistakes, can write it).

**No record for a date is a fourth, implicit state: unknown/not-yet-updated.**
This is deliberate and load-bearing, not an oversight — the UI shows "?
Not updated" rather than silently defaulting to "Available", and the
`availableOn`/`availableFrom`+`availableTo` marketplace search filters only
ever match an explicit `AVAILABLE` row. A vendor who has never touched their
calendar is correctly excluded from "available on this date" search
results, the same as one who marked themselves `UNAVAILABLE`.

## Audit log

`AdminAuditLog` (`adminId`, `action`, `targetType`, `targetId`, `metadata`
JSON, `createdAt`) is a small, reusable audit trail — Phase 1/2 had no audit
mechanism yet, so this is intentionally minimal rather than a general
event-sourcing platform, and Phase 6 integrates with this existing model
rather than introducing a second one (the Phase 6 spec's "if an audit
system already exists, integrate with it" - it does). Every write goes
through the same `audit.service.recordAdminAction(adminId, action,
targetType, targetId, metadata)` helper. Writers, as of Phase 6:

- `PATCH /admin/vendors/:id/availability/:date` — `targetType: "vendor"`,
  records old/new availability status (Phase 3).
- `PATCH /admin/vendors/:id/verify` — `action: "VENDOR_VERIFIED"` /
  `"VENDOR_REJECTED"` / `"VENDOR_PENDING"`, `targetType: "vendor"`,
  `metadata: { from, to }` (verification status).
- `PATCH /admin/vendors/:id/status` — `action: "VENDOR_ACTIVATED"` /
  `"VENDOR_DEACTIVATED"`, `targetType: "vendor"`.
- `PATCH /admin/customers/:id/status` — `action: "CUSTOMER_ACTIVATED"` /
  `"CUSTOMER_DEACTIVATED"`, `targetType: "user"`.
- `PATCH /admin/reviews/:id/status` — `action: "REVIEW_PENDING"` /
  `"REVIEW_PUBLISHED"` / `"REVIEW_HIDDEN"` / `"REVIEW_REJECTED"`,
  `targetType: "review"`, `metadata: { from, to }` (review status).

There's still no read API/UI for this — inspect it via `prisma studio` for
now (`npm run prisma:studio` in `backend/`) — see
[Known trade-offs](#known-trade-offs--remaining-issues).

## Double-booking foundation

This is now implemented (Phase 3 designed the primitive; Phase 4 uses it).
The `@@unique([vendorId, date])` constraint on `VendorAvailability` means
there is **exactly one row** that can ever exist for a given vendor/date, so
`booking.service.acceptBooking` claims every required date with a single
conditional update per date, inside a transaction - never a read-then-write:

```sql
UPDATE vendor_availability SET status = 'BOOKED'
WHERE vendor_id = ? AND date = ? AND status = 'AVAILABLE'
```

which in the actual code (`backend/src/services/booking.service.ts`) covers
every date in the booking's range in one call:

```ts
const flip = await tx.vendorAvailability.updateMany({
  where: { vendorId, date: { in: requiredDates }, status: "AVAILABLE" },
  data: { status: "BOOKED" },
});
if (flip.count !== requiredDates.length) {
  // Someone else's booking claimed at least one of these dates first -
  // roll back the transaction and return 409 to the vendor.
  throw ApiError.conflict("These dates are no longer available.", "VENDOR_NOT_AVAILABLE");
}
```

Under concurrent requests, Postgres's row-level locking on the `UPDATE`
guarantees only one of two simultaneous acceptance attempts can flip a given
row; the loser's `updateMany` affects fewer rows than expected, the
transaction throws and rolls back, and the booking stays `PENDING` (the
vendor must decline it, or accepting it will keep failing until the
customer cancels). No application-level locking, queueing or "fake"
concurrency handling was used - the database constraint *is* the mechanism.
This was verified under real concurrent requests, not just reasoned about:
see [Verification performed](#verification-performed).

Creating a booking (`PENDING`) deliberately does **not** claim the dates -
it only checks they're currently `AVAILABLE`. Multiple customers can have
overlapping `PENDING` requests for the same date; whichever one the vendor
accepts first wins the race above, and accepting a second, now-conflicting
one correctly fails with 409.

## Booking state machine

`BookingStatus` is `PENDING | ACCEPTED | DECLINED | CANCELLED | COMPLETED |
PAYMENT_PENDING | CONFIRMED`, but Phase 4 only implements the transitions
it actually needs - everything else is rejected with 409
`INVALID_STATUS_TRANSITION`, enforced centrally by `ALLOWED_TRANSITIONS` in
`backend/src/services/booking.service.ts`:

```
PENDING   → ACCEPTED    (vendor)
PENDING   → DECLINED    (vendor)
PENDING   → CANCELLED   (customer or vendor)
ACCEPTED  → CANCELLED   (customer or vendor)
ACCEPTED  → CONFIRMED   (system only - see below)
CONFIRMED → COMPLETED   (vendor - see below)
```

`ACCEPTED → CONFIRMED` is deliberately **not** reachable from any request
body — there is no route that lets a customer, vendor or admin set
`status=CONFIRMED` directly. The only caller is
`payment.service.applyCapture` → `booking.service.confirmBookingAfterPayment`,
invoked exclusively after a Razorpay payment has been independently
verified (signature check *and* a fresh `fetchPayment` call confirming
`status === "captured"` and the amount matches) — see [Payments](#payments).

`CONFIRMED → COMPLETED` is new in Phase 6 -
`PATCH /vendors/me/bookings/:id/complete` (vendor-only, own booking). Unlike
`CONFIRMED`, this one *is* reachable from a route, but with its own guard:
`booking.service.completeBooking` rejects it with 409
`EVENT_NOT_YET_OCCURRED` unless `eventEndDate ?? weddingDate` has already
passed (real wall-clock time) - a vendor can't mark a booking "delivered"
before the event has even happened, which matters because it's also the
gate on being reviewable (see [Reviews](#reviews)).

`PAYMENT_PENDING` stays reserved/unreachable (in-flight payment state lives
on `Payment.status`/`Booking.paymentStatus`, not `Booking.status` - see
[Payments](#payments)) - no faking it. A booking only ever becomes
snapshotted-and-real via `POST /bookings`; nothing else in this codebase
creates or backdates one.

## Payments

### Razorpay setup

By default (`RAZORPAY_KEY_ID=rzp_test_stub_dev_only` in `.env.example`),
the backend uses an in-memory `StubPaymentProvider` instead of talking to
Razorpay at all - see [Provider abstraction](#provider-abstraction) below.
To use real Razorpay Test Mode credentials instead:

1. Create a free account at <https://dashboard.razorpay.com/> and switch to
   **Test Mode**.
2. Under **Settings → API Keys**, generate a Test key and copy the Key
   Id/Key Secret into `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` in
   `backend/.env`. Any value not starting with `rzp_test_stub` switches the
   app over to the real `RazorpayPaymentProvider`.
3. Under **Settings → Webhooks**, add a webhook pointing at
   `<BACKEND_PUBLIC_URL>/api/v1/payments/webhook/razorpay` (use a tunnel
   like `ngrok` for local development), subscribe to at least
   `payment.captured` and `payment.failed`, and copy the webhook secret
   into `RAZORPAY_WEBHOOK_SECRET`.
4. Restart the backend. `isStubPaymentProvider` (see `config/env.ts`) flips
   to `false` and `/api/v1/dev/payments/*` stops existing (404).

`isProduction && isStubPaymentProvider` throws at server startup - the stub
can never accidentally run in a production deployment.

### Provider abstraction

`backend/src/payments/types.ts` defines a `PaymentProvider` interface
(`createOrder`, `verifyPaymentSignature`, `verifyWebhookSignature`,
`fetchPayment`, `refundPayment`) - the same "interface + swappable
implementation" shape as `StorageProvider` from Phase 2. Two
implementations exist:

- **`RazorpayPaymentProvider`** - the real implementation, using the
  official `razorpay` npm SDK for network calls and local HMAC-SHA256
  computation (matching Razorpay's documented algorithm exactly, via the
  shared `backend/src/payments/signature.ts` helpers) for signature
  verification.
- **`StubPaymentProvider`** - an in-memory simulation (no network calls)
  selected automatically whenever `RAZORPAY_KEY_ID` still equals the
  sentinel `rzp_test_stub_dev_only`. Its order/payment state lives in
  module-level `Map`s, but its `verifyPaymentSignature`/
  `verifyWebhookSignature` use the **exact same** HMAC functions as the real
  provider - so every layer of this app above the provider boundary
  (signature verification, amount matching, webhook idempotency, the
  booking/commission state transitions) is exercised with 100% real code,
  in tests and in manual/browser verification alike. Only "make an HTTP
  call to Razorpay's servers" is faked. The stub also exposes
  `simulateCheckoutCompletion`/`buildSimulatedWebhook` (not part of the
  `PaymentProvider` interface) for tests and for the dev-only
  `/api/v1/dev/payments/*` routes.

Neither the frontend nor any business-logic service ever imports Razorpay's
SDK or the stub directly - only `backend/src/payments/index.ts`'s
`getPaymentProvider()` factory decides which one is active.

### Payment flow

1. Customer requests a booking, vendor accepts it (Phase 4, unchanged).
   `Booking.advanceAmount` was snapshotted at creation time from the
   package's `advancePercentage` (see the Vendor packages API above).
2. Frontend calls `POST /bookings/:bookingId/payment/order`. The backend
   re-validates the booking is `ACCEPTED`, owned by the caller, and has a
   positive `advanceAmount`; creates (or reuses an in-flight) `Payment` row
   and a Razorpay order; returns just enough for Checkout to open
   (`amount`, `currency`, the order id, and Razorpay's *public* key id -
   never a secret).
3. Frontend opens Razorpay Checkout (or, against the stub provider,
   simulates a completed checkout via `/dev/payments/simulate-checkout` -
   see `frontend/src/components/PayAdvanceButton.tsx`).
4. On success, the frontend calls `POST /payments/verify` with what
   Checkout returned. **The backend never trusts this by itself**: it
   verifies the HMAC signature, then makes an independent `fetchPayment`
   call back to the provider and checks the returned amount and status
   (`captured`) itself before doing anything. A signature or amount
   mismatch marks the `Payment` `FAILED` and returns 400 -
   `Booking.status` never moves.
5. Only once verification independently confirms a captured payment does
   `payment.service.applyCapture` (in one transaction): create a
   `PaymentAttempt`, mark the `Payment` `CAPTURED`, compute and record a
   `Commission` row, and call `booking.service.confirmBookingAfterPayment`
   to flip `Booking.status` to `CONFIRMED`.
6. Razorpay's webhook (`POST /payments/webhook/razorpay`) independently
   reaches the same `applyCapture`/`failPayment` functions for
   `payment.captured`/`payment.failed` events - so a payment is confirmed
   correctly even if the customer's browser is closed before step 4 runs,
   and a race between the webhook and the browser's own verify call can
   never double-apply a capture (see [Webhook idempotency](#webhook-idempotency--race-safety)).

### Webhook idempotency & race safety

- **Redelivery**: `PaymentWebhookEvent` has a `@@unique([provider, providerEventId])`
  constraint. `recordEvent` always attempts an insert first; a duplicate
  delivery collides (Prisma error code `P2002`), which is caught and
  treated as "already handled, acknowledge without reprocessing" - the
  exact same pattern as the Phase 3/4 double-booking guard (an atomic
  database constraint, not an application-level check-then-act).
- **Browser-vs-webhook race**: `applyCapture` re-reads the `Payment` row
  *inside* its transaction before doing anything. If it's already
  `CAPTURED` (or otherwise terminal), the function returns immediately
  without creating a second `PaymentAttempt`/`Commission` row or
  re-confirming the booking - whichever of "the browser's verify call" or
  "Razorpay's webhook" reaches the database first wins, and the second is a
  safe no-op. This was verified directly (see
  [Verification performed](#verification-performed)), not just reasoned
  about.
- **Raw body requirement**: `POST /api/v1/payments/webhook/razorpay` is
  mounted in `backend/src/app.ts` *before* `express.json()`, using
  `express.raw({ type: "application/json" })` specifically for that one
  route - Razorpay's webhook signature is computed over the exact raw
  request bytes, and re-serializing a `JSON.parse()`'d body would produce a
  different (and wrong) signature.

### Booking/payment state integration

`BookingPaymentStatus` (`Booking.paymentStatus`) is
`NOT_REQUIRED | PENDING | PARTIALLY_PAID | PAID | FAILED | REFUNDED` and
tracks in-flight payment state independently of `Booking.status` - a
booking can be `ACCEPTED` with `paymentStatus: FAILED` (ready for a fresh
payment attempt) without ever touching the booking status machine itself.
Only a verified captured payment ever sets `paymentStatus: PAID` and
`Booking.status: CONFIRMED` together, atomically, in the same transaction -
see step 5 above.

### Commission

`backend/src/services/commission.service.ts` is a pure function:
`commissionAmount = round(grossAmount * PLATFORM_COMMISSION_PERCENTAGE / 100)`,
`vendorAmount = grossAmount - commissionAmount`. A `Commission` row is
created once, at capture time, 1:1 with the `Payment` that produced it
(`@@unique([paymentId])` - not with the `Booking`, since a future `BALANCE`
payment on the same booking will need its own commission row later). This
is a **record only** - no vendor payout, settlement, or transfer is
automated in Phase 5 (see [Future roadmap](#future-roadmap)).

### Refunds

`POST /admin/payments/:id/refund` (admin-only) supports full or partial
refunds of a `CAPTURED`/`PARTIALLY_REFUNDED` payment. Omitting `amount`
refunds whatever remains unrefunded (computed via an aggregate over prior
`REFUND`-type `Payment` rows linked by `refundOfPaymentId`); an amount
larger than what remains is rejected (400). Each refund creates its own new
`Payment` row (`paymentType: REFUND`, `refundOfPaymentId` pointing at the
original) rather than mutating history - the original payment's full
capture record is preserved. `Booking.paymentStatus` only moves to
`REFUNDED` on a **full** refund; a partial refund leaves it `PAID`, since
`BookingPaymentStatus` has no partially-refunded value and most of the
advance is still genuinely captured. A refund never changes `Booking.status`
- a refunded booking stays exactly as `CONFIRMED`/`ACCEPTED`/etc. as it was;
refunding doesn't unmake a booking. This is a **foundation, not automation**
- no vendor-side bank settlement is triggered by a refund.

### Security

- **Never trust the frontend**: no endpoint accepts an `amount` or a
  `status`/`CONFIRMED` value from a request body - see step 2 and step 4
  above.
- **No secrets ever leave the backend**: `RAZORPAY_KEY_SECRET`/
  `RAZORPAY_WEBHOOK_SECRET` are read only inside `backend/src/payments/`.
  `Payment.providerSignature` is stripped from every response
  (`payment.service.toSafePayment`) - grep the frontend and you won't find
  it referenced anywhere.
- **No card/CVV/UPI PIN data is ever stored** - Razorpay Checkout collects
  that directly; this app only ever sees an order id, a payment id and a
  signature.
- **IDOR**: `GET /payments/:id` 404s (not 403s) for a payment that isn't
  the caller's - see [User roles / permissions](#user-roles--permissions).
- See [Security checklist](#security-checklist-phase-1--2--3--4--5--6) for the
  full list, and [Verification performed](#verification-performed) for
  what was actually tested (including the `git diff`/`git status --ignored`
  secret check every phase in this repo runs before being marked done).

## Reviews

### Eligibility ("Verified Booking")

A review is always tied to exactly one booking - `Review.bookingId` is
`@unique`, a database-level "one review per booking" guarantee, not just an
application check. `POST /bookings/:bookingId/review` requires, in order:

1. The booking belongs to the calling customer (404 `BOOKING_NOT_FOUND`
   otherwise - same IDOR pattern as every other booking-scoped route).
2. The booking's status is `COMPLETED` (409 `BOOKING_NOT_COMPLETED`
   otherwise) - see [Booking state machine](#booking-state-machine) for how
   a booking gets there (vendor-triggered, only after the event date has
   passed).
3. No review already exists for this booking (409 `REVIEW_ALREADY_EXISTS`).

There is no path for a vendor to review itself (only `Role.CUSTOMER` routes
exist for creating/editing a review) and no path for a customer to review a
vendor without a real completed booking. Every review the frontend renders
publicly carries a "Verified Booking" badge unconditionally, because that's
the only kind of review that can exist.

### Validation & content security

`rating` is an integer 1-5 (zod `.min(1).max(5)`, a 400 outside that
range). `comment` is 10-2000 characters; `title` is optional, up to 150.
Both go through `sanitizePlainText()` (`backend/src/utils/sanitize.ts`),
which strips HTML tags before storage - defense-in-depth on top of React's
default output escaping (this app never uses `dangerouslySetInnerHTML` for
review/message content), so a stored review can never carry markup a future
renderer might trust unescaped. The same sanitizer is applied to message
bodies (see [Messaging](#messaging)).

### Editing & deletion

A customer can edit their own review (`PATCH /reviews/:id`) while it's
`PENDING` or `PUBLISHED` (409 `REVIEW_NOT_EDITABLE` for `HIDDEN`/
`REJECTED` - those need a fresh admin decision, not a customer-side edit).
Editing always re-enters moderation (`PENDING`) unless this deployment sets
`REVIEW_AUTO_PUBLISH=true`, in which case it stays `PUBLISHED` immediately -
see [Moderation](#review-moderation) below. A customer can delete their own
review at any status (`DELETE /reviews/:id`) - it's their content. Both
operations recompute the vendor's rating aggregate in the same transaction
(see [Rating aggregation](#rating-aggregation)). No versioning/history is
kept for edits - this is deliberately not a complicated feature.

### Review moderation

`ReviewStatus` is `PENDING | PUBLISHED | HIDDEN | REJECTED`. New and edited
reviews start `PENDING` by default (`REVIEW_AUTO_PUBLISH=false`, see
`.env.example`) - only `PATCH /admin/reviews/:id/status` (admin-only) can
move a review to `PUBLISHED`, `HIDDEN` (pull an already-public review from
view - a moderation action, not a delete, so the row and its history
survive) or `REJECTED` (never was public). `GET /admin/reviews` filters by
`status`/`vendorId`/`customerId`, paginated. Every moderation action is
recorded to `AdminAuditLog` (`REVIEW_PENDING`/`REVIEW_PUBLISHED`/
`REVIEW_HIDDEN`/`REVIEW_REJECTED`) and, for `PUBLISHED`/`REJECTED`, notifies
the reviewing customer (`REVIEW_PUBLISHED`/`REVIEW_REJECTED` - see
[Notifications](#notifications)). Reviews are never permanently deleted by
an admin action - only status changes, so a moderation decision is always
auditable.

### Rating aggregation

`Vendor.averageRating`/`Vendor.reviewCount` are a denormalized mirror of
that vendor's `PUBLISHED` reviews only - never calculated live from a
`Review` table scan on every profile/search request, which is exactly the
"expensive full-table calculation on every request" the Phase 6 spec says
to avoid. Instead, `review.repository.recalculateVendorRating(tx, vendorId)`
runs a single `AVG`/`COUNT` aggregate query and writes the two columns,
always **inside the same transaction** as whatever review write could have
changed the `PUBLISHED` set (create, edit, delete, or an admin moderation
action) - recomputed from scratch every time, never incrementally
patched, so it can never drift out of sync and never race under concurrent
moderation actions. The public vendor profile's rating distribution
(`5★ - 100`, `4★ - 18`, ...) is a separate one-query `GROUP BY rating`
aggregate (`ratingDistributionForVendor`), computed on read since it's only
needed on the profile page itself, not on every search result card.

### Vendor search

`GET /vendors` gained `minRating` (filters `Vendor.averageRating >= n`) and
a `rating` sort option (`averageRating desc, reviewCount desc, createdAt desc`
- review count as the tiebreaker, so one lucky 5-star review doesn't
outrank a vendor with a large, consistently well-rated review base). The
default `relevance` sort now factors rating in too, but per the Phase 6
spec's "don't make rating the only ranking mechanism" - it's still
`verificationStatus desc, averageRating desc, createdAt desc` in that
order, so a verified vendor with no reviews yet still outranks an unrated
listing. Every existing filter (city, locality, category, price,
availability, search, verified) keeps working exactly as before.

### Public vendor profile

`GET /vendors/:vendorId/reviews` (public, no auth) returns `PUBLISHED`
reviews only, paginated, plus a `summary` (`averageRating`, `reviewCount`,
star `distribution`). Each review item includes the reviewing customer's
`name` only - never `email` or `phone` (the query's `include` never selects
them in the first place, so there's nothing to accidentally leak) and never
any private booking detail beyond the booking number already shown
elsewhere. `GET /vendors/me/reviews` (vendor-only) is the vendor's-eye
equivalent that includes every status, so a vendor sees a `PENDING` review
the moment they're notified about it, not just once it's published.

## Messaging

`Conversation` is one row per `(customerId, vendorId)` pair (`@@unique`), so
a customer and vendor always end up in the same thread no matter how many
bookings or inquiries they've exchanged - `bookingId` just records which
booking (if any) the thread is currently associated with for the UI's
"back to booking" link, and is set the first time a booking-scoped
conversation is opened. `Message.isRead` means "read by the *other*
participant", never the sender; `PATCH /conversations/:id/read` marks every
message not sent by the caller as read, and the conversation list's
`_count.messages` is that same count per conversation, computed as a
correlated subquery in one query (no N+1 - see
`conversation.repository.findConversationsForCustomer`/`ForVendor`).

Real-time delivery is additive, not required: `POST /conversations/:id/messages`
and `PATCH /conversations/:id/read` are the only way a message is ever
persisted or marked read, whether triggered from a REST call or from the
Socket.IO handlers in `backend/src/realtime/socket.ts` (which call those
exact same service functions). The frontend only uses the socket to receive
`message:new`/`message:read` broadcasts for whichever conversation is open
(`useConversationSocket`); sending and marking-read always go through the
REST `api/conversations.ts` module, so chat keeps working even if the
socket never connects. Message bodies go through the same
`sanitizePlainText()` HTML-stripping helper reviews use - see
[Validation & content security](#validation--content-security).

## Notifications

### Architecture

`backend/src/services/notification.service.ts` is the single write path
for every `Notification` row in this app - no controller creates one
directly, and no other service reaches into `notificationRepository`
itself. It has two layers:

- **Hook points** business services call after a real state change: the
  Phase 4/5 ones (`notifyBookingCreated`, `notifyBookingAccepted`,
  `notifyBookingDeclined`, `notifyBookingCancelled`, `notifyBookingConfirmed`,
  `notifyNewMessage`, `notifyPaymentCaptured`, `notifyPaymentFailed`) plus
  Phase 6 additions (`notifyBookingCompleted`, `notifyPaymentRefunded`,
  `notifyReviewReceived`, `notifyReviewPublished`, `notifyReviewRejected`,
  `notifyVendorVerified`, `notifyVendorRejected`, `notifyVendorActivated`,
  `notifyVendorDeactivated`) - these used to be `console.debug`-only no-ops
  (Phase 4/5); they now persist a real `Notification` row, with the exact
  same call sites, so no booking/payment/message code needed to change
  shape when this landed.
- **A small "notification center" API** (`listMyNotifications`,
  `getUnreadCount`, `markRead`, `markAllRead`, `deleteNotification`) behind
  `GET /notifications`, `GET /notifications/unread-count`,
  `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`,
  `DELETE /notifications/:id`.

A vendor-facing notification needs the vendor's *User* id, not their
*Vendor* id (`Booking.vendorId`/`Payment.vendorId`/`Review.vendorId` are
all `Vendor.id`) - rather than require every call site to pre-fetch and
pass that, `notification.service.ts` resolves it itself
(`vendorUserId(vendorId)`), so booking/payment/review services stay free of
notification-plumbing concerns.

### Who gets notified

- **Booking created** → the vendor only (no self-notification for the
  customer who just created it).
- **Accepted/declined/confirmed/completed** → the customer.
- **Confirmed** → *both* the customer and the vendor (advance payment
  received is relevant to both sides).
- **Cancelled** → only the party that *didn't* cancel it -
  `notifyBookingCancelled(booking, cancelledByUserId)` takes the actor's id
  explicitly and resolves the other party, so the canceller never gets a
  redundant notification about their own action.
- **Payment success/failed/refunded** → the customer; success also
  notifies the vendor ("advance payment received").
- **New message** → the *recipient* only, resolved from the conversation's
  `customerId`/`vendor.userId` against `message.senderId` - the sender
  never gets a notification about their own message.
- **Review received** → the vendor, the moment a customer submits one
  (regardless of moderation status).
- **Review published/rejected** → the customer, only as a moderation
  outcome (not on `HIDDEN` - see [Review moderation](#review-moderation)).
- **Vendor verified/rejected/activated/deactivated** → the vendor.

### Duplicate prevention

No extra notification-specific dedup logic exists, because none is needed:
every notify call sits behind the same idempotency guard that already
protects the underlying state change. `applyCapture`'s "already
`CAPTURED`, no-op" check (see
[Webhook idempotency & race safety](#webhook-idempotency--race-safety))
means a redelivered Razorpay webhook can't trigger `notifyPaymentCaptured`
twice; `assertTransition` means a booking action can't be retried into a
second notification once it's already applied. Notifications ride on top
of state transitions that were already made exactly-once-safe - they don't
need their own separate dedup layer.

### API & ownership

Every notification is scoped to `req.user.id` server-side -
`requireOwnNotification` 404s (not 403s) for another user's notification id
on read/mark-read/delete, the same IDOR pattern as every other owned
resource in this app. `GET /notifications` supports `?unreadOnly=true` and
standard `page`/`limit` pagination - the frontend's notification center
never loads "everything" in one request. `GET /notifications/unread-count`
is a single indexed `COUNT` (`@@index([userId, isRead])`), cheap enough to
poll from a nav badge.

### Frontend

`NotificationBell` (in every authenticated layout's navbar) polls
`unread-count` every 30s and shows a dropdown of the latest few on click;
`NotificationsPage` (`/dashboard/notifications`, `/vendor/notifications`)
is the full center with All/Unread tabs, pagination, and mark-all-read.
Clicking a notification marks it read and navigates via
`utils/notificationTarget.ts`, which maps `(entityType, entityId)` plus the
viewer's role to a destination - the same `entityType: "booking"` means
`/dashboard/bookings/:id` for a customer but `/vendor/bookings/:id` for a
vendor, so one notification record serves both audiences correctly.

## Admin back office

Vendor and category management already existed (Phase 2); Phase 6 adds
customer management, a real dashboard, review moderation (see
[Review moderation](#review-moderation)) and basic analytics on top.

### Admin customer management

`GET /admin/customers` (`?isActive=&search=&page=&limit=`) lists `User`
rows with `role: CUSTOMER` only - vendors are managed via `/admin/vendors`,
admins aren't listable at all. Each row includes `_count.weddingEvents`/
`_count.bookings` (a single query via Prisma's relation `_count`, no N+1)
and `createdAt`, but never `passwordHash` - the repository's `select`
clause never includes it in the first place, so there's nothing to
accidentally serialize. `PATCH /admin/customers/:id/status` activates/
deactivates a customer (`isActive`), same shape as vendor activation, and
is recorded to `AdminAuditLog`.

### Admin dashboard

`GET /admin/dashboard` runs a dozen small, indexed `count`/`aggregate`
queries in parallel (`Promise.all`, not sequential round-trips) and returns
real numbers - total/verified/pending/active vendors, total customers,
bookings by status (total/pending/confirmed/completed), captured payment
volume + successful/failed payment counts, and total/pending reviews.
Nothing here is hardcoded; every number reflects the current database
state at request time.

### Admin analytics

`GET /admin/analytics?range=7d|30d|90d|1y` adds time-bucketed trends on top
of the dashboard's point-in-time counts: bookings by status, bookings over
time, captured-payment volume over time, and new-customer/new-vendor
registrations over time, plus a simple booking-conversion rate
(`CONFIRMED + COMPLETED` bookings ÷ all-time total bookings) and the
overall review count. `7d`/`30d` bucket by day, `90d`/`1y` bucket by month -
computed via `date_trunc('day' | 'month', ...)` through `prisma.$queryRaw`
(the bucket unit is always one of those two literal strings computed
server-side from the validated `range` enum, never the raw query string
itself, so this is still a parameterized query, not string-concatenated
SQL). Every count is cast to `::int` (not `::bigint`) specifically to avoid
`BigInt`-isn't-JSON-serializable footguns - these are demo-scale
aggregates, comfortably within `int4` range. This is deliberately a
foundation - see [Known trade-offs](#known-trade-offs--remaining-issues)
for what a real analytics platform would still need.

## Authentication flow

1. `POST /auth/register` — public, always creates a `CUSTOMER`. Password is
   hashed with bcrypt before storage; the hash is never returned or logged.
2. `POST /auth/login` — verifies the password, returns a short-lived access
   token (15m default) and sets an httpOnly, `SameSite=Lax` refresh-token
   cookie scoped to `/api/v1/auth` (7d default). The refresh token is stored
   server-side only as a SHA-256 hash, so a database read can't be replayed.
3. The frontend keeps the access token in memory only (never
   `localStorage`) and attaches it as `Authorization: Bearer <token>`.
4. On a 401, the frontend calls `POST /auth/refresh` once (using the cookie)
   to get a new access token and retries the original request. The backend
   rotates the refresh token on every use (old one is revoked).
5. `POST /auth/logout` revokes the current refresh token server-side and
   clears the cookie.
6. `requireAuth` middleware verifies the access token and attaches
   `req.user = { id, role }`. `requireRole(...)` checks that role. The role
   is always read from the verified backend session — never from anything
   the client sends.

## User roles / permissions

- **CUSTOMER** — default role for all public registrations. Can create
  wedding events, favorite vendors, filter vendor search by date
  availability/rating, request/cancel bookings, message vendors, review a
  `COMPLETED` booking (and edit/delete their own review), and read/manage
  their own notifications. A deactivated customer (`isActive: false`, admin
  only) can still be looked up by id but authentication itself is gated on
  this flag the same way it always has been (see
  [Authentication flow](#authentication-flow)).
- **VENDOR** — can manage its own business profile, portfolio, packages,
  availability calendar, booking requests (accept/decline/cancel/complete),
  see reviews about itself (every status, not just published), and
  read/manage its own notifications. Not self-assignable via public
  registration; cannot verify itself; cannot set its own availability to
  `BOOKED` directly (only accepting a booking does that); cannot moderate
  its own or anyone else's reviews (publish/hide/reject is admin-only).
- **ADMIN** — can access `/admin/*`: manage categories, verify/activate
  vendors, activate/deactivate customers, view/correct vendor availability,
  inspect (read-only) every booking and payment, issue refunds, moderate
  reviews, and view the dashboard/analytics. Cannot be created via public
  registration under any circumstances; must be created directly in the
  database (e.g. via `prisma studio` or a seed script) by an operator.

Payment visibility follows the same ownership model: a customer sees only
their own payments, a vendor sees only payments on their own bookings
(never another vendor's), and only an admin can see every payment or issue
a refund. `Payment.providerSignature` is never included in any response to
any role. Review visibility follows the same shape: a `PUBLISHED` review is
public, anything else is visible only to its author, the reviewed vendor's
own account, or an admin. Notifications are always scoped to
`req.user.id` server-side, regardless of role.

Enforcement is backend-only. The frontend's `ProtectedRoute` /
role-conditional navigation is for UX; it never substitutes for backend
authorization. Every ownership check (a vendor's own package/portfolio/
availability record/booking, a customer's own wedding event/booking, a
conversation participant) is done server-side against the authenticated
user id, never a client-supplied id, and returns 404 (not 403) for another
user's resource so a response never confirms whether a given id belongs to
someone else.

## Development test accounts

Created by `npm run seed` in `backend/`. **Development-only, obviously fake
credentials — never use in production:**

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@example.test` | `DevPassword123` |
| CUSTOMER | `customer@example.test` (has a demo wedding event) | `DevPassword123` |
| CUSTOMER | `customer2@example.test` | `DevPassword123` |
| VENDOR | `vendor@example.test` and 19 other `demo-*@example.test` vendors | `DevPassword123` |

None of the seeded vendors are real businesses.

## Verification performed

- `npm run typecheck`, `npm run lint`, `npm run build` pass on both
  `backend/` and `frontend/`.
- `npm test` in `backend/` — 205 tests passing against a real Postgres test
  database (see [Test commands](#test-commands) for coverage).
- Full manual verification via curl: registration, admin self-registration
  block, login/refresh/logout, vendor search filters (category/city/price/
  verified/date), sort, pagination limits, rejected-vendor exclusion, public
  vendor profile field exposure, admin verify/activate, vendor-vs-vendor
  package/portfolio/availability IDOR (404), file upload (valid image
  accepted and served back, disallowed file type rejected), availability
  upsert semantics, bulk range set, past-date and oversized-range rejection,
  `availableOn`/`availableFrom`+`availableTo` search filtering exactly
  matching the spec's worked examples (a vendor `AVAILABLE` on a date is
  included; `UNAVAILABLE`, `BLOCKED`, and no record at all are all
  excluded), admin availability view/correction with an audit-log row
  confirmed in the database, booking creation with unavailable/unknown/
  blocked dates all correctly rejected with 409, **the double-booking race
  itself**: two customers requesting the same date, the vendor accepting
  the first (dates verified `BOOKED` in the database), then accepting the
  second correctly failing with 409 and the first booking staying intact,
  cancelling the accepted booking reopening the date to `AVAILABLE`, every
  IDOR case in section 27/28 of the Phase 4 spec (customer-vs-customer,
  vendor-vs-vendor, on bookings and on conversations), a conversation
  reused rather than duplicated on repeat creation, and a live Socket.IO
  round trip (authenticated connect, room join with the same authorization
  check as the REST endpoint, `message:send` persisting via the real
  message service and broadcasting to the other participant, and an
  unauthenticated socket connection being rejected).
- End-to-end browser verification (headless Chromium) of all critical
  flows: customer (login → browse → filter by category → open vendor →
  view portfolio/packages → save vendor → create wedding via the 6-step
  wizard; dashboard's "Show available vendors" CTA → date-filtered search →
  vendor profile → public availability calendar), vendor (login →
  dashboard tabs → portfolio/packages → Availability tab → mark a date
  Available → reload → confirms it persisted), multi-day filtering (only
  the seeded vendor that's `AVAILABLE` on all 3 days of a demo event's date
  range is returned, exactly matching the seeded data), admin (login →
  vendor list → verify/activate → category management), unauthorized
  access (customer redirected away from every `/admin/*` route by the
  frontend, with the backend independently returning 403 regardless), and
  the full Phase 4 booking+messaging loop end to end through the real UI
  with fresh accounts/dates: create a wedding → open a vendor → mark it
  available (as the vendor, in a separate browser context) → request a
  booking → see it as `PENDING` → vendor opens it and accepts → customer
  reloads and sees `ACCEPTED` → both sides use the messages UI (conversation
  list, thread view, send, unread badge) successfully.
- Phase 5, via curl against the running dev server: full payment order →
  simulate-checkout → verify loop (payment `CAPTURED`, booking flips to
  `CONFIRMED`, commission row created with the correct 10%/90% split),
  duplicate webhook delivery for the same event id (first call processes it,
  second is a no-op - one `PaymentWebhookEvent` row, one `Commission` row),
  an invalid webhook signature rejected with 400, cross-customer/
  cross-vendor payment IDOR (404), admin partial refund followed by a full
  refund of the remainder (verified the booking's `paymentStatus` stays
  `PAID` after the partial refund and only becomes `REFUNDED` after the
  full one), and an over-refund attempt rejected with 400.
- Phase 5, end-to-end browser verification (headless Chromium): customer
  opens an `ACCEPTED` booking, clicks "Pay advance", the stub-simulated
  checkout completes and the page shows "Payment received - your booking is
  confirmed!" with the status badge flipping from `Accepted` to
  `Confirmed`; customer payment history page lists both a `Paid` and a
  `Failed` payment with the failure reason shown, with no provider secret
  anywhere in the page; vendor payment history page shows the same captured
  payment (read-only); admin payments page lists all payments, issues a
  refund through the UI, and the table updates to show `Refunded` on
  reload. A first pass surfaced a genuine bug (the admin refund UI patched
  its table by the *new refund record's* id instead of the original
  payment's, so the row never visually updated even though the backend
  refund succeeded) - fixed by reloading the list after a refund instead of
  trying to patch a single row in place.
- Phase 6, end-to-end browser verification (headless Chromium): customer
  opens a `COMPLETED` booking with no review yet, clicks "Leave a review",
  picks a star rating and writes a comment, submits it, and the page
  immediately shows the new review as `Pending review`; the admin reviews
  page lists it under the Pending filter with the exact rating/comment
  just submitted, clicking **Publish** flips its badge to `Published` in
  place; the vendor's `averageRating`/`reviewCount` are confirmed updated
  in the database immediately after, and the customer received a
  `REVIEW_PUBLISHED` notification; the vendor's public profile page then
  shows the correct `4.0` average, a populated star-distribution bar chart,
  and the published review itself with a "Verified Booking" badge and no
  reviewer contact info. Admin dashboard confirmed to show real non-zero
  counts (matching what was actually seeded/created, not placeholders);
  admin analytics confirmed to render time-bucketed bar charts for every
  range option with real dates; admin customers page lists the seeded
  customer. A direct-navigation attempt to `/admin/customers` as a logged-in
  customer was redirected away by the frontend's route guard (with the
  backend independently enforcing 403 regardless, per
  [User roles / permissions](#user-roles--permissions)).
- A first Playwright pass used a loose `button:has-text('Publish')`
  selector that also matched the "Published" filter pill (whose label
  contains "Publish" as a substring) and clicked that instead of the real
  per-review moderation button - a test-script bug, not an app bug, caught
  by checking the resulting screenshot and re-run with an exact-text
  selector, which confirmed the actual moderation button works correctly.

## Known trade-offs / remaining issues

- `npm audit` flags moderate-severity advisories in `vite`/`esbuild`
  (dev-server-only) and `react-router-dom` (open-redirect edge case,
  server-side-rendering related) that would require breaking major-version
  upgrades to clear. Not exploitable in this app's current dev/CSR setup, but
  worth revisiting before a public deployment.
- No CI pipeline is configured yet — tests/lint/build are run manually per
  the commands above.
- Portfolio image storage is local disk in development (`backend/uploads/`,
  gitignored). It's already behind a `StorageProvider` interface so an
  S3/Cloudinary implementation can be dropped in without touching callers,
  but that implementation doesn't exist yet.
- No CDN/thumbnail generation - uploaded images are served as-is;
  `thumbnailUrl` is currently just the same URL as the full image.
- The admin audit log (`AdminAuditLog`) has a write path but no read
  API/UI yet - inspect it via `prisma studio` for now. See [Audit log](#audit-log).
- The vendor availability bulk-set endpoint does its work as N per-day
  upserts inside one Prisma transaction (bounded to 366 days by validation),
  not a single bulk SQL statement - one HTTP request either way, but not the
  most efficient possible implementation for the largest allowed ranges.
- Socket.IO real-time delivery isn't covered by the automated Jest suite
  (it runs against `createApp()` directly, without an HTTP server to attach
  Socket.IO to) - it's verified manually instead (see
  [Verification performed](#verification-performed)). REST remains fully
  functional and is what every automated test exercises, by design.
- Notifications are in-app only (no email/push/SMS delivery yet) - see
  [Notifications](#notifications) and [Future roadmap](#future-roadmap).
- The unread-messages badge and the unread-notifications badge both poll
  every 30 seconds rather than using a persistent global socket connection;
  an open conversation thread itself is fully real-time (see
  [Messaging](#messaging)). If a viewer is actively looking at the exact
  page a notification would send them to, they still get the notification -
  there's no "already viewing it, skip the notification" presence check.
- No review edit history/versioning is kept - editing a review overwrites
  the previous rating/comment in place (see [Reviews](#reviews)); an admin
  moderating a review only ever sees its current content, not what it used
  to say before an edit.
- The admin analytics booking-conversion rate
  (`CONFIRMED + COMPLETED ÷ total`) is all-time, not scoped to the selected
  `range` - a per-range conversion funnel would need per-transition
  timestamps this schema doesn't track yet (see
  [Admin analytics](#admin-analytics)).
- No vendor payout/settlement automation exists - `Commission` is a record
  only (see [Commission](#commission)); actually transferring a vendor's
  share of a captured payment is a future phase.
- `BookingPaymentStatus` has no `PARTIALLY_REFUNDED` value, so a partial
  refund leaves `Booking.paymentStatus` at `PAID` rather than reflecting the
  partial refund explicitly - the `Payment` row itself (status
  `PARTIALLY_REFUNDED`, plus its linked `REFUND`-type payment row) is the
  source of truth for exactly how much was refunded. See
  [Refunds](#refunds).
- The Razorpay stub provider's order/payment state lives in a module-level
  `Map` in the backend process - it's wiped by a dev-server restart. This
  only matters for interactive manual testing (a booking whose order was
  created before a restart can't be completed against the stub afterward);
  it has no effect on the automated test suite (single process, no
  restarts) or production (real Razorpay API, no in-memory state).
- No GST invoice generation, subscription plans, or advanced admin payment
  analytics/dashboards exist yet - see [Future roadmap](#future-roadmap).

## Security checklist (Phase 1 + 2 + 3 + 4 + 5 + 6)

- Passwords hashed with bcrypt (12 rounds); never returned by the API or logged.
- No hardcoded secrets — `JWT_*` secrets and `DATABASE_URL` come from `.env`,
  which is gitignored; `.env.example` ships placeholders only.
- Public registration cannot create ADMIN (or VENDOR) accounts — role is
  hardcoded server-side.
- Every non-public route goes through `requireAuth`; role-restricted routes
  additionally go through `requireRole(...)`.
- Role is always derived from the verified JWT/DB session, never from
  client-supplied input.
- A vendor can never set its own `verificationStatus` or `eventsCompleted`
  (not accepted by the vendor-facing validator at all); only
  `PATCH /admin/vendors/:id/verify` (ADMIN-only) can change verification.
- Every vendor-package/portfolio and customer-event mutation checks
  ownership against the authenticated user id server-side, returning 404 for
  another user's resource (IDOR protection, covered by tests).
- Portfolio uploads are validated by MIME type and extension (JPEG/PNG/WEBP
  only) and size-capped (5MB) via multer; rejected files never reach disk.
- Prisma parameterizes all queries — no raw/string-concatenated SQL.
- Centralized error handler never leaks stack traces or internal DB errors
  in responses; Prisma unique-constraint violations map to a generic 409.
- CORS is restricted to `FRONTEND_URL` with credentials enabled (needed for
  the refresh cookie), not a wildcard.
- `helmet` sets baseline security headers; refresh cookie is `httpOnly` and
  `secure` in production.
- A vendor can never set its own availability to `BOOKED` (the vendor/bulk
  validators only accept `AVAILABLE`/`UNAVAILABLE`/`BLOCKED`); only the
  ADMIN correction endpoint accepts the full enum.
- Every vendor-availability mutation checks ownership against the
  authenticated user id server-side, returning 404 for another vendor's
  record (IDOR protection, covered by tests) - same pattern as
  packages/portfolio/events.
- The public availability endpoint never returns `note`, `id` or `vendorId`
  - only `{ date, status }` (covered by a test asserting the note text never
  appears in the response body).
- Rate limiting extends past `/auth`: public vendor search and public
  availability lookups (120 req/min), the vendor bulk-availability endpoint
  (10 req/min), and booking creation (20 req/min) all have DoS protection
  via the shared `createRateLimiter` factory
  (`backend/src/middleware/rateLimit.ts`), skipped under `NODE_ENV=test`.
- A booking's `totalAmount` always comes from the server-side package price
  at creation time - the request body has no price field at all for a
  client to override.
- Every booking mutation (create/read/cancel/accept/decline) checks
  ownership against the authenticated user id server-side, returning 404
  for another user's booking (IDOR protection, covered by tests) - same
  pattern as packages/portfolio/events/availability.
- Booking status changes only ever follow `ALLOWED_TRANSITIONS` (see
  [Booking state machine](#booking-state-machine)); anything else is
  rejected with 409, never silently applied.
- The double-booking guard (see [Double-booking foundation](#double-booking-foundation))
  is a database-enforced atomic conditional update, not a check-then-write
  race, and not application-level locking that could be bypassed by two
  server instances.
- A conversation's participants are re-verified on every single access -
  REST request, socket room join, and socket message send - never cached
  or assumed from a prior check (`conversation.service.requireParticipant`,
  called from both the REST controllers and `backend/src/realtime/socket.ts`).
- Socket.IO connections are authenticated with the same JWT access token as
  REST (`backend/src/realtime/socket.ts`'s `io.use` middleware); an
  unauthenticated or invalid-token socket is rejected before it can join
  any room (verified manually - see
  [Verification performed](#verification-performed)).
- Message bodies are length-capped (4000 chars) and empty/whitespace-only
  bodies are rejected server-side, not just in the UI.
- No booking is ever marked `CONFIRMED` from a frontend callback alone - the
  backend independently re-verifies the payment signature and re-fetches
  the payment from Razorpay before applying any state change (see
  [Payment flow](#payment-flow)).
- `RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` are read only inside
  `backend/src/payments/`, never logged, and never included in any API
  response; `Payment.providerSignature` is stripped from every response
  (`payment.service.toSafePayment`).
- No card number, CVV or UPI PIN is ever received or stored by this
  app - Razorpay Checkout collects that directly.
- The Razorpay webhook route verifies the signature over the raw request
  body before parsing it as JSON, rejects a missing/invalid signature with
  400, and is idempotent per event id via a database unique constraint (see
  [Webhook idempotency & race safety](#webhook-idempotency--race-safety)).
- The stub payment provider (and its `/api/v1/dev/payments/*` routes) can
  never run in production - `isProduction && isStubPaymentProvider` throws
  at server startup (`backend/src/config/env.ts`).
- Every payment mutation/read checks ownership against the authenticated
  user id server-side (customer owns the payment, or is the booking's
  vendor), returning 404 for anyone else's payment (IDOR protection,
  covered by tests) - same pattern as bookings/packages/portfolio/events/
  availability.
- Refunds and the admin payment list are ADMIN-only, enforced by
  `requireRole` like every other admin route.
- Only a `COMPLETED` booking's own customer can review its vendor - never a
  random user, never a customer reviewing another customer's booking,
  never a vendor reviewing itself (see [Reviews](#reviews)).
- Only `PUBLISHED` reviews are ever public or counted in a vendor's rating -
  `PENDING`/`HIDDEN`/`REJECTED` ones are visible only to their author, the
  reviewed vendor, or an admin (IDOR-protected, covered by tests).
- Review/message content is sanitized (`sanitizePlainText()` strips HTML
  tags before storage) on top of React's default output escaping - see
  [Validation & content security](#validation--content-security).
- Every admin surface (`/admin/*`) requires `requireAuth` *and*
  `requireRole(ADMIN)` - never enforced by the frontend alone (covered by
  tests hitting every admin route as unauthenticated/customer/vendor).
- `GET /admin/customers` never selects or returns `passwordHash` - the
  repository's Prisma `select` clause never includes it, so there's nothing
  for a response DTO to accidentally forward.
- Every notification is scoped to `req.user.id` server-side
  (`requireOwnNotification`), returning 404 for another user's notification
  id on read/mark-read/delete - same IDOR pattern as every other owned
  resource.
- Booking completion (`CONFIRMED → COMPLETED`) independently re-checks the
  event date has actually passed server-side, not just gated by a disabled
  frontend button - see [Booking state machine](#booking-state-machine).

## Future roadmap (not in Phase 1/2/3/4/5/6)

- Vendor payout/bank settlement automation - `Commission` is a record only
  today (see [Commission](#commission))
- A GST invoice engine for captured payments and commission
- Subscription plans for vendors
- Real notification delivery (email/push/SMS) behind the existing
  `notificationService` hook points - see [Notifications](#notifications),
  which today only ever persists an in-app `Notification` row
- Review edit history/versioning, and a per-range (not all-time) admin
  booking-conversion funnel - see
  [Known trade-offs](#known-trade-offs--remaining-issues)
- A read UI for the admin audit log (the backend API/write-path already
  exists and is read-only-safe - see [Audit log](#audit-log)) and richer
  admin analytics (cohort/retention analysis, vendor-level revenue
  breakdowns) beyond the current dashboard + time-bucketed trends
- `BookingStatus.PAYMENT_PENDING` stays reserved and unreachable until a
  later phase defines what it means (see
  [Booking state machine](#booking-state-machine))
- Email verification for email changes
- Object-storage-backed portfolio uploads (S3/Cloudinary) in production
- Swift iOS app consuming the same `/api/v1` endpoints (the REST API is the
  source of truth for booking/messaging/payments/reviews/notifications even
  with Socket.IO in the mix, specifically so a client that never opens a
  socket - like a first cut of the iOS app - still works fully; the
  `PaymentProvider` abstraction was designed the same way, so a real second
  payment provider could be added without touching booking/commission logic)
