/**
 * @forge/testing — test infrastructure barrel.
 * Conformance suites, behavioral mock adapters and deterministic factories
 * for every port. V3 §3.2, §12.4, Day 5, P12.
 *
 * Depends on @forge/shared and the port packages only; contains no vendor
 * code. Adapters consume the suites to prove replaceability; apps consume
 * mocks and factories in their tests.
 */

// Factories
export {
  FACTORY_TIMESTAMP,
  makeAnalyticsProperties,
  makeAnalyticsTraits,
  makeAuthOrganization,
  makeAuthUser,
  makeBillingCustomer,
  makeBillingPortalParams,
  makeBillingSubscription,
  makeCompletionOptions,
  makeCompletionResult,
  makeCreateCheckoutParams,
  makeCreateCustomerParams,
  makeEmailAddress,
  makeEmailMessage,
  makeEmbedding,
  makeEntitlement,
  makeJob,
  makeJobInfo,
  makeJobOptions,
  makePlan,
  makeReportUsageParams,
  makeStorageBytes,
  makeStorageObject,
  makeTokenUsage,
} from "./factories/index.js";

// Mocks
export {
  createMockAIModelPort,
  createMockAnalyticsPort,
  createMockAuthMiddleware,
  createMockAuthPort,
  createMockAuthWebhookHandler,
  createMockBillingPort,
  createMockBillingStore,
  createMockBillingWebhookHandler,
  createMockEmailPort,
  createMockFeatureFlagPort,
  createMockJobQueue,
  createMockStoragePort,
  mockBillingPayloads,
  type MockAIModelPortOptions,
  type MockAnalyticsPort,
  type MockAuthEvent,
  type MockAuthMiddlewareResponse,
  type MockAuthOptions,
  type MockBillingPayloads,
  type MockBillingStore,
  type MockBillingWebhookOptions,
  type MockEmailPort,
  type MockEmailPortOptions,
  type MockFeatureFlag,
  type MockFeatureFlagPortOptions,
  type MockIdentifyCall,
  type MockPageCall,
  type MockTrackCall,
} from "./mocks/index.js";

// Conformance suites
export {
  runAuthMiddlewareConformance,
  runAuthPortConformance,
  runAuthWebhookConformance,
  type AuthMiddlewareConformanceHarness,
  type AuthPortConformanceFixtures,
  type AuthPortConformanceHarness,
  type AuthWebhookConformanceFixtures,
  type AuthWebhookConformanceHarness,
} from "./conformance/auth.js";
export {
  runBillingConformance,
  type BillingConformanceFixtures,
  type BillingConformanceHarness,
  type BillingConformancePayloads,
} from "./conformance/billing.js";
export {
  runEmailConformance,
  type EmailConformanceFixtures,
  type EmailConformanceHarness,
} from "./conformance/email.js";
export { runJobsConformance, type JobsConformanceHarness } from "./conformance/jobs.js";
export {
  runStorageConformance,
  type StorageConformanceHarness,
} from "./conformance/storage.js";
export {
  runAIProviderConformance,
  type AIProviderConformanceFixtures,
  type AIProviderConformanceHarness,
} from "./conformance/ai-provider.js";
