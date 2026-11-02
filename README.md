# Salon Booking API — Jest Automation Suite

A fully automated Jest + Supertest test suite for a Node.js / Express / TypeScript salon booking backend. Tests run against an in-memory MongoDB instance, so no external database is needed.

---

## Prerequisites

| Requirement | Version                              |
| ----------- | ------------------------------------ |
| Node.js     | **≥ 18.x** (LTS recommended)  |
| npm         | ≥ 9.x                               |
| TypeScript  | ≥ 5.x (installed as dev dependency) |

> No external MongoDB instance or third-party service is required. Tests use [`mongodb-memory-server`](https://github.com/nodkz/mongodb-memory-server) which spins up an in-process MongoDB automatically.

---

## Environment Setup

Create a `.env` file in the project root (a sample is already included). The following variables are used:

```env
# MongoDB connection URI (only used by the dev/production server, NOT by tests)
MONGO_URI=mongodb://localhost:27017/salon-db

# JWT signing secret
JWT_SECRET=supersecretjwtkey_12345

# Server port
PORT=3000
```

> **Tests do not read `.env`** — they use the in-memory DB and the fallback JWT secret baked into the source, so no environment configuration is needed to run the test suite.

---

## Installation

```bash
npm install
```

---

## How to Run Tests

### Run all tests (watch mode)

```bash
npm test
```

### Run all tests once (CI / one-shot)

```bash
npx jest --no-coverage
```

### Run a specific test file

```bash
npx jest __test__/user.test.ts --no-coverage
npx jest __test__/booking.test.ts --no-coverage
npx jest __test__/salon.test.ts --no-coverage
npx jest __test__/auth.middleware.test.ts --no-coverage
```

---

## Test Suite Overview

All tests live in the `__test__/` directory. The suite covers **37 test cases across 4 files**.

### `user.test.ts` — Auth Controller (8 tests)

Tests `POST /api/register` and `POST /api/login`.

| Test                                             | Scenario |
| ------------------------------------------------ | -------- |
| Rejects duplicate email on register              | Negative |
| Hashes password before saving                    | Positive |
| Saves user and returns 201                       | Positive |
| Returns 500 on unexpected DB error (register)    | Negative |
| Returns 400 for unknown email on login           | Negative |
| Returns 400 for wrong password                   | Negative |
| Returns JWT token + role + userId on valid login | Positive |
| Returns 500 on unexpected DB error (login)       | Negative |

---

### `auth.middleware.test.ts` — Auth Middleware (6 tests)

Tests the `authMiddleware` that protects private routes.

| Test                                                          | Scenario |
| ------------------------------------------------------------- | -------- |
| Returns 401 when Authorization header is missing              | Negative |
| Returns 401 for empty bearer value                            | Negative |
| Returns 401 and "Invalid token" when jwt.verify throws        | Negative |
| Returns 401 when token is valid but user is deleted           | Negative |
| Attaches user to `req` and calls `next()` for valid token | Positive |
| Passes the correct JWT secret to `jwt.verify`               | Positive |

---

### `booking.test.ts` — Booking Controller (13 tests)

Tests `POST /api/bookings` (create) and `POST /api/bookings/:id/cancel`.

| Test                                                              | Scenario |
| ----------------------------------------------------------------- | -------- |
| Returns 400 when date is missing                                  | Negative |
| Returns 404 when service does not exist                           | Negative |
| Returns 400 for overlapping time slot                             | Negative |
| Allows back-to-back slot (no overlap)                             | Positive |
| Creates booking with correct end time (10:30 + 45 min = 11:15)    | Positive |
| Calculates end time across hour boundary (09:50 + 30 min = 10:20) | Positive |
| Returns 500 on unexpected DB error (create)                       | Negative |
| Returns 404 when booking to cancel does not exist                 | Negative |
| Returns 403 when another customer tries to cancel                 | Negative |
| Admin can cancel any booking regardless of ownership              | Positive |
| Returns 400 when booking is already cancelled                     | Negative |
| Successfully cancels booking and persists the change              | Positive |
| Returns 500 on unexpected DB error (cancel)                       | Negative |

---

### `salon.test.ts` — Salon Controller (10 tests)

Tests `GET /api/salons/:salonId/available-slots`.

| Test                                                           | Scenario  |
| -------------------------------------------------------------- | --------- |
| Returns 400 when both date and serviceId are missing           | Negative  |
| Returns 400 when only date is provided                         | Negative  |
| Returns 400 when only serviceId is provided                    | Negative  |
| Returns 404 when salon does not exist                          | Negative  |
| Returns 404 when service does not exist                        | Negative  |
| Returns empty slots when service duration exceeds salon window | Edge Case |
| Excludes busy stylist, keeps available stylist                 | Positive  |
| Returns all stylists in every slot when no bookings exist      | Positive  |
| Includes service name and duration in response payload         | Positive  |
| Returns 500 on unexpected DB error                             | Negative  |

---

## Project Structure

```
.
├── __test__/                 
│   ├── auth.middleware.test.ts
│   ├── booking.test.ts
│   ├── salon.test.ts
│   └── user.test.ts
├── test/
│   └── setup.ts             
├── controllers/
│   ├── authController.ts
│   ├── bookingController.ts
│   └── salonController.ts
├── middleware/
│   └── auth.ts
├── models/
│   ├── Booking.ts
│   ├── Salon.ts
│   ├── Service.ts
│   └── User.ts
├── routes/
│   ├── authRoutes.ts
│   ├── bookingRoutes.ts
│   └── salonRoutes.ts
├── utils/
│   └── seed.ts              
├── index.ts                  
├── package.json
└── tsconfig.json
```

---

## Test Configuration

Jest is configured inside `package.json`:

```json
"jest": {
  "preset": "ts-jest",
  "testEnvironment": "node",
  "setupFilesAfterEnach": ["./test/setup.ts"],
  "testMatch": ["**/__test__/**/*.test.ts"]
}
```

**`test/setup.ts`** handles the full MongoDB lifecycle:

- `beforeAll` — starts `MongoMemoryServer` and connects Mongoose
- `beforeEach` — wipes all collections between tests (clean slate)
- `afterEach` — restores all Jest spies (`jest.restoreAllMocks()`)
- `afterAll` — disconnects Mongoose and stops the in-memory server

---

## Assumptions

- All tests use **unit-level mocking** (`jest.spyOn`) to isolate controllers from the database. No real DB calls are made in any test.
- The JWT fallback secret (`supersecretjwtkey_12345`) is used for token signing/verification in tests.
- Booking dates use the format `YYYY-MM-DD` and times use `HH:mm` (24-hour).
- Only `customer` role can self-register; `stylist` and `admin` accounts must be seeded via `utils/seed.ts`.
