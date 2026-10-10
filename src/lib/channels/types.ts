/**
 * A way to deliver a wish. WhatsApp is the only one for now; SMS, email,
 * Telegram etc. plug in by implementing this interface.
 */
export interface Channel {
  readonly id: "whatsapp";
  /** Whether the user's account on this channel is connected right now. */
  isReady(userId: string): boolean;
  /** Send a text message. Throws on failure. */
  send(userId: string, to: string, text: string): Promise<{ providerMessageId?: string }>;
  /** Whether `to` can receive messages on this channel, or null if unknown. */
  checkRecipient(userId: string, to: string): Promise<boolean | null>;
}

export class ChannelNotReadyError extends Error {
  constructor() {
    super("WhatsApp is not connected");
  }
}
