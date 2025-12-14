// Minimal declaration for sib-api-v3-sdk to satisfy TypeScript
declare module "sib-api-v3-sdk" {
  export const ApiClient: unknown;
  export class TransactionalEmailsApi {
    constructor();
    sendTransacEmail(body: unknown): Promise<unknown>;
  }
  export class SendSmtpEmail {
    constructor(init?: Record<string, unknown>);
  }
}
