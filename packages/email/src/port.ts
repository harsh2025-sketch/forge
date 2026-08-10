/**
 * EmailPort — transactional message delivery capability contract.
 * V3 §5.2. Implemented by adapters only; never by this package.
 */

import type { EmailBatchSendResult, EmailMessage, EmailSendResult } from "./types.js";

export interface EmailPort {
  /**
   * Delivers a single message.
   * Throws `EmailPortError` with code `EMAIL_SEND_FAILED` when the message is rejected.
   */
  send(message: EmailMessage): Promise<EmailSendResult>;

  /**
   * Delivers a batch of messages, returning one identifier per accepted message
   * in input order.
   */
  sendBatch(messages: readonly EmailMessage[]): Promise<EmailBatchSendResult>;
}
