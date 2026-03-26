import type { Response } from "express";

jest.mock("../../src/services/groupsService", () => ({
  listGroups: jest.fn(),
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

import { listGroupsHandler } from "../../src/controllers/groupsController";
import { listGroups } from "../../src/services/groupsService";

const mockedListGroups = listGroups as jest.MockedFunction<typeof listGroups>;

function createResponseMock(): Response {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  return response as unknown as Response;
}

describe("groupsController.listGroupsHandler", () => {
  it("returns groups with their member ids", async () => {
    mockedListGroups.mockResolvedValue([
      {
        id: 5,
        name: "Planeringsgruppen",
        description: "Tvarloge-grupp for planering av gemensamma moten.",
        userIds: [1, 9, 10],
      },
    ]);

    const res = createResponseMock();

    await listGroupsHandler({} as never, res, jest.fn());

    expect(mockedListGroups).toHaveBeenCalledTimes(1);
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(200);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith({
      groups: [
        {
          id: 5,
          name: "Planeringsgruppen",
          description: "Tvarloge-grupp for planering av gemensamma moten.",
          userIds: [1, 9, 10],
        },
      ],
    });
  });
});
