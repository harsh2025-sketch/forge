/**
 * @forge/email — email port.
 * Provider-neutral contracts only. Depends on @forge/shared and nothing else.
 * V3 §3.2, §4.1, §5.2.
 */

export type {
  EmailAddress,
  EmailBatchSendResult,
  EmailMessage,
  EmailMessageId,
  EmailPortErrorOptions,
  EmailRecipient,
  EmailSendResult,
} from "./types.js";
export { EmailErrorCode, EmailPortError } from "./types.js";

export type { EmailPort } from "./port.js";
