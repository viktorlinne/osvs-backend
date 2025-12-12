// Minimal declaration for sib-api-v3-sdk to satisfy TypeScript
declare module "sib-api-v3-sdk" {
  export const ApiClient: any;
  export class TransactionalEmailsApi {
    constructor();
    sendTransacEmail(body: any): Promise<any>;
  }
  export class SendSmtpEmail {
    constructor(init?: any);
  }
}
