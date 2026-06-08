import type { Request, Response } from "express";

jest.mock("../../src/services/userService", () => ({
  revokeAllSessions: jest.fn(),
  createUser: jest.fn(),
  deleteUserAccount: jest.fn(),
  findById: jest.fn(),
  getUserRoles: jest.fn(),
  getUserAchievements: jest.fn(),
  getUserAllergies: jest.fn(),
  getUserOfficials: jest.fn(),
  getUserOfficialsHistory: jest.fn(),
}));

jest.mock("../../src/services/passwordActionService", () => ({
  __esModule: true,
  default: {
    createGeneratedPasswordHash: jest.fn(),
    sendInitialPasswordSetupEmail: jest.fn(),
    requestPasswordReset: jest.fn(),
    verifyPasswordAction: jest.fn(),
    completePasswordAction: jest.fn(),
  },
}));

jest.mock("../../src/controllers/helpers/storage", () => ({
  uploadImageAndPersist: jest.fn(),
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

import { register } from "../../src/controllers/authController";
import {
  createUser,
  deleteUserAccount,
  getUserRoles,
} from "../../src/services/userService";
import passwordActionService from "../../src/services/passwordActionService";
import { uploadImageAndPersist } from "../../src/controllers/helpers/storage";
import { getPublicUrl } from "../../src/utils/fileUpload";

const mockedCreateUser = createUser as jest.MockedFunction<typeof createUser>;
const mockedDeleteUserAccount =
  deleteUserAccount as jest.MockedFunction<typeof deleteUserAccount>;
const mockedGetUserRoles = getUserRoles as jest.MockedFunction<typeof getUserRoles>;
const mockedPasswordActionService =
  passwordActionService as jest.Mocked<typeof passwordActionService>;
const mockedUploadImageAndPersist =
  uploadImageAndPersist as jest.MockedFunction<typeof uploadImageAndPersist>;
const mockedGetPublicUrl = getPublicUrl as jest.MockedFunction<typeof getPublicUrl>;

function createResponseMock(): Response {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  return response as unknown as Response;
}

describe("authController.register", () => {
  beforeEach(() => {
    mockedPasswordActionService.createGeneratedPasswordHash.mockResolvedValue(
      "generated-password-hash",
    );
    mockedPasswordActionService.sendInitialPasswordSetupEmail.mockResolvedValue(
      undefined,
    );
    mockedCreateUser.mockResolvedValue({
      matrikelnummer: 77,
      email: "new.member@example.com",
      createdAt: "2026-03-15T10:00:00.000Z",
      firstname: "Ny",
      lastname: "Medlem",
      dateOfBirth: "1990-01-01",
      mobile: "0700000000",
      city: "Karlskrona",
      address: "Gatan 1",
      zipcode: "37130",
      picture: "profiles/member.webp",
    });
    mockedDeleteUserAccount.mockResolvedValue(undefined);
    mockedGetUserRoles.mockResolvedValue(["Member"]);
    mockedGetPublicUrl.mockResolvedValue("https://cdn.example.com/member.webp");
    mockedUploadImageAndPersist.mockImplementation(async (_file, _options, persist) =>
      persist("profiles/member.webp"),
    );
  });

  it("parses multipart allergyIds and sends a password setup email", async () => {
    const req = {
      body: {
        email: "new.member@example.com",
        firstname: "Ny",
        lastname: "Medlem",
        dateOfBirth: "1990-01-01",
        mobile: "0700000000",
        city: "Karlskrona",
        address: "Gatan 1",
        zipcode: "37130",
        lodgeId: "2",
        allergyIds: "1, 3",
      },
      file: {
        fieldname: "picture",
      },
    } as RequestWithFile;
    const res = createResponseMock();

    await register(req, res, jest.fn());

    expect(mockedCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new.member@example.com",
        passwordHash: "generated-password-hash",
        firstname: "Ny",
        lastname: "Medlem",
      }),
      {
        lodgeId: 2,
        allergyIds: [1, 3],
      },
    );
    expect(
      mockedPasswordActionService.sendInitialPasswordSetupEmail,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        matrikelnummer: 77,
        email: "new.member@example.com",
      }),
    );
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(201);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteEmailSent: true,
      }),
    );
  });

  it("returns field validation when allergyIds is provided but contains no valid ids", async () => {
    const req = {
      body: {
        email: "new.member@example.com",
        firstname: "Ny",
        lastname: "Medlem",
        dateOfBirth: "1990-01-01",
        mobile: "0700000000",
        city: "Karlskrona",
        address: "Gatan 1",
        zipcode: "37130",
        allergyIds: "abc",
      },
      file: {
        fieldname: "picture",
      },
    } as RequestWithFile;
    const res = createResponseMock();

    await register(req, res, jest.fn());

    expect(mockedCreateUser).not.toHaveBeenCalled();
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(400);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith({
      message: "FormulÃ¤ret innehÃ¥ller fel",
      details: {
        fields: {
          allergyIds: "Ogiltiga allergier",
        },
      },
    });
  });

  it("removes the newly created user when the invite email fails", async () => {
    mockedPasswordActionService.sendInitialPasswordSetupEmail.mockRejectedValue(
      new Error("smtp down"),
    );

    const req = {
      body: {
        email: "new.member@example.com",
        firstname: "Ny",
        lastname: "Medlem",
        dateOfBirth: "1990-01-01",
        mobile: "0700000000",
        city: "Karlskrona",
        address: "Gatan 1",
        zipcode: "37130",
      },
      file: {
        fieldname: "picture",
      },
    } as RequestWithFile;
    const res = createResponseMock();

    await expect(register(req, res, jest.fn())).rejects.toMatchObject({
      status: 500,
      message: "Kunde inte skicka inbjudningsmejlet",
    });

    expect(mockedDeleteUserAccount).toHaveBeenCalledWith(77);
  });
});

type RequestWithFile = Request & {
  file?: {
    fieldname?: string;
  };
};
