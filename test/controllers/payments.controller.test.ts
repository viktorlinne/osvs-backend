import express from "express";
import request from "supertest";

jest.mock("../../src/services", () => ({
  listMembershipPaymentsForUser: jest.fn(),
  listAllMembershipPayments: jest.fn(),
  setMembershipPaymentStatus: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child() {
      return this;
    },
  },
}));

import errorHandler from "../../src/middleware/errorHandler";
import authMiddleware from "../../src/middleware/auth";
import { requireRole } from "../../src/middleware/authorize";
import { wrapAsync } from "../../src/middleware/asyncHandler";
import {
  getMyMembershipsHandler,
  getAllMembershipsHandler,
  updateMembershipStatusHandler,
} from "../../src/controllers/paymentsController";
import {
  listMembershipPaymentsForUser,
  setMembershipPaymentStatus,
} from "../../src/services";
import type { AuthenticatedRequest } from "../../src/types/auth";

jest.mock("../../src/middleware/auth", () => ({
  __esModule: true,
  default: jest.fn((_req, _res, next) => next()),
}));

jest.mock("../../src/middleware/authorize", () => ({
  requireRole: jest.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next(),
  ),
}));

const mockedListForUser = listMembershipPaymentsForUser as jest.MockedFunction<
  typeof listMembershipPaymentsForUser
>;
const mockedSetStatus = setMembershipPaymentStatus as jest.MockedFunction<
  typeof setMembershipPaymentStatus
>;

function buildApp(user?: { matrikelnummer: number }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (user) {
      (req as AuthenticatedRequest).user = user;
    }
    next();
  });
  app.get("/membership", wrapAsync(getMyMembershipsHandler));
  app.get(
    "/membership/admin",
    authMiddleware,
    requireRole("Admin"),
    wrapAsync(getAllMembershipsHandler),
  );
  app.patch(
    "/membership/:id/status",
    authMiddleware,
    requireRole("Admin"),
    wrapAsync(updateMembershipStatusHandler),
  );
  app.use(errorHandler);
  return app;
}

describe("paymentsController", () => {
  beforeEach(() => {
    mockedListForUser.mockResolvedValue([]);
    mockedSetStatus.mockResolvedValue({
      id: 4,
      uid: 2,
      amount: 600,
      year: 2026,
      status: "Paid",
    });
  });

  it("returns current user's membership payments", async () => {
    mockedListForUser.mockResolvedValue([
      { id: 1, uid: 5, amount: 600, year: 2026, status: "Pending" },
    ]);

    const response = await request(buildApp({ matrikelnummer: 5 })).get(
      "/membership",
    );

    expect(response.status).toBe(200);
    expect(response.body.payments).toHaveLength(1);
    expect(mockedListForUser).toHaveBeenCalledWith(5);
  });

  it("rejects invalid membership status updates", async () => {
    const response = await request(buildApp({ matrikelnummer: 1 }))
      .patch("/membership/4/status")
      .send({ status: "Invalid" });

    expect(response.status).toBe(400);
    expect(mockedSetStatus).not.toHaveBeenCalled();
  });

  it("updates membership payment status for admin route", async () => {
    const response = await request(buildApp({ matrikelnummer: 1 }))
      .patch("/membership/4/status")
      .send({ status: "Paid" });

    expect(response.status).toBe(200);
    expect(mockedSetStatus).toHaveBeenCalledWith(4, "Paid");
    expect(response.body.payment.status).toBe("Paid");
  });

  it("returns 404 when membership payment is missing", async () => {
    mockedSetStatus.mockResolvedValue(null);

    const response = await request(buildApp({ matrikelnummer: 1 }))
      .patch("/membership/999/status")
      .send({ status: "Paid" });

    expect(response.status).toBe(404);
  });
});
