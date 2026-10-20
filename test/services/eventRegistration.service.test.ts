jest.mock("../../src/config/db", () => ({
  __esModule: true,
  default: {
    getConnection: jest.fn(),
    query: jest.fn(),
  },
}));

jest.mock("../../src/repositories/events.repo", () => ({
  getEventAttendanceFromDb: jest.fn(),
  upsertEventRegistration: jest.fn(),
  upsertEventAttendance: jest.fn(),
  upsertUserBookFood: jest.fn(),
}));

import * as eventsRepo from "../../src/repositories/events.repo";
import {
  getUserRegistration,
  saveUserRegistration,
} from "../../src/services/events/rsvp";

const mockedEventsRepo = eventsRepo as jest.Mocked<typeof eventsRepo>;

describe("saveUserRegistration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedEventsRepo.upsertEventRegistration.mockResolvedValue(undefined);
  });

  it("stores rsvp and bookFood in one write", async () => {
    const result = await saveUserRegistration(42, 5, true, {
      rsvp: true,
      bookFood: true,
    });

    expect(result).toEqual({ rsvp: true, bookFood: true });
    expect(mockedEventsRepo.upsertEventRegistration).toHaveBeenCalledTimes(1);
    expect(mockedEventsRepo.upsertEventRegistration).toHaveBeenCalledWith(42, 5, {
      rsvp: 1,
      bookFood: 1,
    });
    expect(mockedEventsRepo.upsertEventAttendance).not.toHaveBeenCalled();
    expect(mockedEventsRepo.upsertUserBookFood).not.toHaveBeenCalled();
  });

  it("forces bookFood false when not attending", async () => {
    const result = await saveUserRegistration(42, 5, true, {
      rsvp: false,
      bookFood: true,
    });

    expect(result).toEqual({ rsvp: false, bookFood: false });
    expect(mockedEventsRepo.upsertEventRegistration).toHaveBeenCalledWith(42, 5, {
      rsvp: 0,
      bookFood: 0,
    });
  });

  it("forces bookFood false when the event has no food", async () => {
    const result = await saveUserRegistration(42, 5, false, {
      rsvp: true,
      bookFood: true,
    });

    expect(result).toEqual({ rsvp: true, bookFood: false });
    expect(mockedEventsRepo.upsertEventRegistration).toHaveBeenCalledWith(42, 5, {
      rsvp: 1,
      bookFood: 0,
    });
  });

  it("propagates write failures instead of reporting success", async () => {
    mockedEventsRepo.upsertEventRegistration.mockRejectedValue(new Error("db down"));

    await expect(
      saveUserRegistration(42, 5, true, { rsvp: true, bookFood: true }),
    ).rejects.toThrow("db down");
  });
});

describe("getUserRegistration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns prefilled standing-list values as the starting point", async () => {
    mockedEventsRepo.getEventAttendanceFromDb.mockResolvedValue({
      rsvp: 1,
      bookFood: 1,
      attended: 0,
    } as never);

    await expect(getUserRegistration(42, 5, true)).resolves.toEqual({
      rsvp: true,
      bookFood: true,
    });
  });

  it("returns rsvp null for an unanswered invitation", async () => {
    mockedEventsRepo.getEventAttendanceFromDb.mockResolvedValue({
      rsvp: 2,
      bookFood: 0,
      attended: 0,
    } as never);

    await expect(getUserRegistration(42, 5, true)).resolves.toEqual({
      rsvp: null,
      bookFood: false,
    });
  });

  it("reports bookFood false for events without food", async () => {
    mockedEventsRepo.getEventAttendanceFromDb.mockResolvedValue({
      rsvp: 1,
      bookFood: 1,
      attended: 0,
    } as never);

    await expect(getUserRegistration(42, 5, false)).resolves.toEqual({
      rsvp: true,
      bookFood: false,
    });
  });

  it("returns rsvp null when there is no row", async () => {
    mockedEventsRepo.getEventAttendanceFromDb.mockResolvedValue(null as never);

    await expect(getUserRegistration(42, 5, true)).resolves.toEqual({
      rsvp: null,
      bookFood: false,
    });
  });
});
