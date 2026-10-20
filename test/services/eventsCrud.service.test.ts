jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: {
    getConnection: jest.fn(),
  },
}));

jest.mock("../../src/repositories/events.repo", () => ({
  updateEventRecord: jest.fn(),
  updatePendingEventPaymentsAmount: jest.fn(),
  insertEvent: jest.fn(),
  selectEventFood: jest.fn(),
}));

jest.mock("../../src/services/events/audience", () => {
  const actual = jest.requireActual("../../src/services/events/audience");
  return { ...actual, syncEventAudience: jest.fn() };
});

import pool from "../../src/config/db";
import * as eventsRepo from "../../src/repositories/events.repo";
import { syncEventAudience } from "../../src/services/events/audience";
import {
  createEventWithAudience,
  updateEvent,
} from "../../src/services/events/eventsCrud";

const mockedSyncEventAudience = syncEventAudience as jest.MockedFunction<
  typeof syncEventAudience
>;

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

  it("does not request a standing list prefill when the audience is updated", async () => {
    const conn = createConnectionMock();
    mockedPool.getConnection.mockResolvedValue(conn);
    const audience = { lodgeIds: [1], groupIds: [], userIds: [] };
    mockedSyncEventAudience.mockResolvedValue(audience);

    await updateEvent(14, { title: "Nytt namn" }, audience);

    expect(mockedSyncEventAudience).toHaveBeenCalledTimes(1);
    const options = mockedSyncEventAudience.mock.calls[0][2];
    expect(options).not.toHaveProperty("prefillStandingList");
  });
});

describe("eventsCrud.createEventWithAudience", () => {
  const payload = {
    title: "Logemöte",
    description: "Beskrivning",
    price: 250,
    startDate: "2026-11-01 18:00:00",
    endDate: "2026-11-01 22:00:00",
  };
  const audience = { lodgeIds: [2], groupIds: [], userIds: [] };

  it.each([[true], [false]])(
    "prefills the standing list using the stored food flag (food=%s)",
    async (food) => {
      const conn = createConnectionMock();
      mockedPool.getConnection.mockResolvedValue(conn);
      mockedEventsRepo.insertEvent.mockResolvedValue(55);
      mockedEventsRepo.selectEventFood.mockResolvedValue(food);
      mockedSyncEventAudience.mockResolvedValue(audience);

      const id = await createEventWithAudience(payload, audience);

      expect(id).toBe(55);
      expect(mockedEventsRepo.selectEventFood).toHaveBeenCalledWith(55, conn);
      expect(mockedSyncEventAudience).toHaveBeenCalledWith(55, audience, {
        conn,
        requireAudience: true,
        price: 250,
        prefillStandingList: { food },
      });
      expect(conn.commit).toHaveBeenCalled();
    },
  );
});
