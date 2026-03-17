import type { Response } from "express";

jest.mock("../../src/services/userService", () => ({
  listPublicUsers: jest.fn(),
}));

jest.mock("../../src/utils/fileUpload", () => ({
  getPublicUrl: jest.fn(),
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

import { listUsersHandler } from "../../src/controllers/usersController";
import { listPublicUsers } from "../../src/services/userService";
import { getPublicUrl } from "../../src/utils/fileUpload";

const mockedListPublicUsers = listPublicUsers as jest.MockedFunction<
  typeof listPublicUsers
>;
const mockedGetPublicUrl = getPublicUrl as jest.MockedFunction<typeof getPublicUrl>;

function createResponseMock(): Response {
  const response = {
    set: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  return response as unknown as Response;
}

describe("usersController.listUsersHandler", () => {
  beforeEach(() => {
    mockedGetPublicUrl.mockResolvedValue("https://cdn.example.com/member.webp");
  });

  it("returns paginated users with metadata and picture urls", async () => {
    mockedListPublicUsers.mockResolvedValue({
      users: [
        {
          matrikelnummer: 77,
          email: "ny.medlem@example.com",
          createdAt: "2026-03-15T10:00:00.000Z",
          picture: "profiles/member.webp",
          firstname: "Ny",
          lastname: "Medlem",
          dateOfBirth: "1990-01-01",
          mobile: "0700000000",
          city: "Karlskrona",
          address: "Gatan 1",
          zipcode: "37130",
        },
      ],
      total: 41,
      page: 2,
      pageSize: 10,
      totalPages: 5,
    });

    const req = {
      query: {
        name: " Viktor ",
        achievementId: "3",
        lodgeId: "2",
        officialId: "4",
        accommodationAvailable: "1",
        page: "2",
        pageSize: "10",
      },
    };
    const res = createResponseMock();

    await listUsersHandler(req as never, res, jest.fn());

    expect(mockedListPublicUsers).toHaveBeenCalledWith({
      name: "Viktor",
      achievementId: 3,
      lodgeId: 2,
      officialId: 4,
      accommodationAvailable: true,
      page: 2,
      pageSize: 10,
    });
    expect((res.set as jest.Mock)).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store",
    );
    expect(mockedGetPublicUrl).toHaveBeenCalledWith("profiles/member.webp");
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(200);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith({
      users: [
        expect.objectContaining({
          matrikelnummer: 77,
          pictureUrl: "https://cdn.example.com/member.webp",
        }),
      ],
      total: 41,
      page: 2,
      pageSize: 10,
      totalPages: 5,
    });
  });

  it("falls back to safe pagination defaults for invalid query values", async () => {
    mockedListPublicUsers.mockResolvedValue({
      users: [],
      total: 0,
      page: 1,
      pageSize: 100,
      totalPages: 0,
    });

    const req = {
      query: {
        page: "0",
        pageSize: "250",
      },
    };
    const res = createResponseMock();

    await listUsersHandler(req as never, res, jest.fn());

    expect(mockedListPublicUsers).toHaveBeenCalledWith({
      name: undefined,
      achievementId: undefined,
      lodgeId: undefined,
      officialId: undefined,
      accommodationAvailable: undefined,
      page: 1,
      pageSize: 100,
    });
    expect((res.set as jest.Mock)).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store",
    );
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(200);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith({
      users: [],
      total: 0,
      page: 1,
      pageSize: 100,
      totalPages: 0,
    });
  });
});
