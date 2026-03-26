jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: {
    getConnection: jest.fn(),
  },
}));

jest.mock("../../src/repositories/events.repo", () => ({
  updateEventRecord: jest.fn(),
  updatePendingEventPaymentsAmount: jest.fn(),
}));

import pool from "../../src/config/db";
import * as eventsRepo from "../../src/repositories/events.repo";
import { updateEvent } from "../../src/services/events/eventsCrud";

const mockedPool = pool as unknown as {
  getConnection: jest.Mock;
};
const mockedEventsRepo = eventsRepo as jest.Mocked<typeof eventsRepo>;

function createConnectionMock() {
  return {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
}

describe("eventsCrud.updateEvent", () => {
  beforeEach(() => {
    mockedEventsRepo.updateEventRecord.mockResolvedValue(undefined);
    mockedEventsRepo.updatePendingEventPaymentsAmount.mockResolvedValue(undefined);
  });

  it("reprices pending event payments when only the event price changes", async () => {
    const conn = createConnectionMock();
    mockedPool.getConnection.mockResolvedValue(conn);

    await updateEvent(14, { price: 350 });

    expect(conn.beginTransaction).toHaveBeenCalled();
    expect(mockedEventsRepo.updateEventRecord).toHaveBeenCalledWith(
      14,
      { price: 350 },
      conn,
    );
    expect(mockedEventsRepo.updatePendingEventPaymentsAmount).toHaveBeenCalledWith(
      14,
      350,
      conn,
    );
    expect(conn.commit).toHaveBeenCalled();
  });
});
