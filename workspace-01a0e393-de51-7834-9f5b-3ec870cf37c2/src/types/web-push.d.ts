/* تعریف نوع کتابخانهٔ web-push (بدون وابستگی به @types) */
declare module "web-push" {
  interface PushSubscriptionLike {
    endpoint: string;
    keys?: { p256dh?: string; auth?: string };
    expirationTime?: number | null;
  }
  interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }
  interface WebPushError extends Error {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  }
  interface WebPush {
    setVapidDetails(subject: string, publicKey: string, privateKey: string, contentEncoding?: string): void;
    sendNotification(subscription: PushSubscriptionLike, payload?: string | Buffer | null, options?: Record<string, unknown>): Promise<SendResult>;
    generateVAPIDKeys(): { publicKey: string; privateKey: string };
  }
  const webPush: WebPush;
  export default webPush;
}
