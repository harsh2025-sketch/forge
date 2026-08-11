/**
 * Test data factories barrel — deterministic builders for every port type.
 * V3 §3.2 (packages/testing/src/factories/).
 */

export { makeAuthOrganization, makeAuthUser } from "./auth.js";
export {
  makeBillingCustomer,
  makeBillingPortalParams,
  makeBillingSubscription,
  makeCreateCheckoutParams,
  makeCreateCustomerParams,
  makeEntitlement,
  makePlan,
  makeReportUsageParams,
} from "./billing.js";
export { makeEmailAddress, makeEmailMessage } from "./email.js";
export { makeAnalyticsProperties, makeAnalyticsTraits } from "./analytics.js";
export { FACTORY_TIMESTAMP, makeJob, makeJobInfo, makeJobOptions } from "./jobs.js";
export { makeStorageBytes, makeStorageObject } from "./storage.js";
export {
  makeCompletionOptions,
  makeCompletionResult,
  makeEmbedding,
  makeTokenUsage,
} from "./ai-provider.js";
