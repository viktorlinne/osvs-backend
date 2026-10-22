const mockSendMail = jest.fn();
jest.mock("nodemailer", () => ({
  __esModule: true,
  default: { createTransport: () => ({ sendMail: mockSendMail }) },
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { sendPasswordActionMail } from "../../src/services/mailService";

describe("password mail escapes the member name (audit A-07)", () => {
  beforeEach(() => mockSendMail.mockReset().mockResolvedValue({}));

  it.each(["SET_PASSWORD", "RESET_PASSWORD"] as const)(
    "%s: HTML-escapes the greeting, keeps plain text readable",
    async (purpose) => {
      await sendPasswordActionMail({
        purpose,
        toEmail: "member@example.com",
        toName: '<a href="https://evil.example">Klicka</a> & Co',
        token: "tok",
        expiresAt: new Date("2026-10-22T12:00:00Z"),
      });

      const message = mockSendMail.mock.calls[0][0] as { html: string; text: string };
      expect(message.html).not.toContain('<a href="https://evil.example">');
      expect(message.html).toContain(
        "Hej &lt;a href=&quot;https://evil.example&quot;&gt;Klicka&lt;/a&gt; &amp; Co,",
      );
      expect(message.text).toContain('Hej <a href="https://evil.example">Klicka</a> & Co,');
    },
  );
});
