declare module 'nodemailer' {
  export function createTransport(options: object): {
    sendMail(options: { from: string; to: string; subject: string; text?: string; html?: string }): Promise<unknown>;
  };
}
