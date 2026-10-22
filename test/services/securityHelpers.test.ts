const mockUpload = jest.fn();
jest.mock("../../src/infra/storage/database", () => ({
  databaseStorageAdapter: {
    upload: (...args: unknown[]) => mockUpload(...args),
    delete: jest.fn(),
    getUrl: jest.fn(),
  },
}));

import { Buffer } from "buffer";
import type { Request } from "express";
import { isArchivedMember } from "../../src/services/accountStatus";
import { scrubSentryEvent } from "../../src/utils/sentryScrub";
import { getAuthCookieSecurity } from "../../src/utils/authTokens";
import { looksLikePdf, uploadRawToStorage } from "../../src/utils/fileUpload";
import { ValidationError } from "../../src/utils/errors";

describe("isArchivedMember (audit A-01)", () => {
  it.each([
    [{ archive: "Avliden" }, true],
    [{ archive: "Urgången" }, true],
    [{ archive: "Avförd" }, true],
    [{ archive: null }, false],
    [{ archive: "" }, false],
    [{}, false],
    [undefined, false],
  ])("%j -> %s", (user, expected) => {
    expect(isArchivedMember(user as { archive?: unknown })).toBe(expected);
  });
});

describe("scrubSentryEvent (audit A-02)", () => {
  it("removes cookies, body, query string and credential headers", () => {
    const event = {
      message: "boom",
      request: {
        url: "https://osvs.se/api/auth/login",
        method: "POST",
        cookies: { accessToken: "jwt", refreshToken: "secret" },
        data: { email: "a@b.se", password: "hunter2" },
        query_string: "token=abc",
        headers: {
          Cookie: "accessToken=jwt",
          authorization: "Bearer jwt",
          "x-forwarded-for": "1.2.3.4",
          "user-agent": "jest",
        },
      },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request).toEqual({
      url: "https://osvs.se/api/auth/login",
      method: "POST",
      headers: { "user-agent": "jest" },
    });
    expect(JSON.stringify(scrubbed)).not.toMatch(/hunter2|secret|jwt/);
  });

  it("leaves events without request data unchanged", () => {
    const event = { message: "worker failed" };
    expect(scrubSentryEvent(event)).toEqual({ message: "worker failed" });
  });
});

describe("getAuthCookieSecurity (audit A-06)", () => {
  const original = { env: process.env.NODE_ENV, sameSite: process.env.COOKIE_SAMESITE };

  afterEach(() => {
    process.env.NODE_ENV = original.env;
    if (original.sameSite === undefined) delete process.env.COOKIE_SAMESITE;
    else process.env.COOKIE_SAMESITE = original.sameSite;
  });

  it("defaults to SameSite=Lax and Secure in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.COOKIE_SAMESITE;
    expect(getAuthCookieSecurity()).toEqual({ secure: true, sameSite: "lax" });
  });

  it("uses Lax without Secure in development", () => {
    process.env.NODE_ENV = "development";
    delete process.env.COOKIE_SAMESITE;
    expect(getAuthCookieSecurity()).toEqual({ secure: false, sameSite: "lax" });
  });

  it("allows an explicit cross-site setup, always Secure", () => {
    process.env.NODE_ENV = "development";
    process.env.COOKIE_SAMESITE = "None";
    expect(getAuthCookieSecurity()).toEqual({ secure: true, sameSite: "none" });
  });

  it("falls back to Lax for unknown values", () => {
    process.env.NODE_ENV = "production";
    process.env.COOKIE_SAMESITE = "sometimes";
    expect(getAuthCookieSecurity().sameSite).toBe("lax");
  });
});

describe("PDF content check (audit A-08)", () => {
  function pdfFile(buffer: Buffer) {
    return {
      fieldname: "file",
      originalname: "protokoll.pdf",
      mimetype: "application/pdf",
      buffer,
      size: buffer.length,
    } as unknown as NonNullable<Request["file"]>;
  }

  it("recognises a PDF header", () => {
    expect(looksLikePdf(Buffer.from("%PDF-1.7\n..."))).toBe(true);
    expect(looksLikePdf(Buffer.from("\n\n%PDF-1.4"))).toBe(true);
    expect(looksLikePdf(Buffer.from("<html><script>alert(1)</script>"))).toBe(false);
    expect(looksLikePdf(Buffer.alloc(0))).toBe(false);
  });

  it("rejects a non-PDF declared as application/pdf before storing it", async () => {
    await expect(
      uploadRawToStorage(pdfFile(Buffer.from("<html>not a pdf</html>")), {
        bucket: "documents",
        allowedExtensions: [".pdf"],
        fallbackExtension: ".pdf",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("stores a real PDF", async () => {
    mockUpload.mockResolvedValue({ key: "media/9" });
    await expect(
      uploadRawToStorage(pdfFile(Buffer.from("%PDF-1.7\n%%EOF\n")), {
        bucket: "documents",
        allowedExtensions: [".pdf"],
        fallbackExtension: ".pdf",
      }),
    ).resolves.toBe("media/9");
  });
});
