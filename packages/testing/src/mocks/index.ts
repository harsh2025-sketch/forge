/**
 * Mock adapters barrel — behavioral in-memory implementations of every port.
 * V3 §3.2 (packages/testing/src/mocks/).
 */

export {
  createMockAuthMiddleware,
  createMockAuthPort,
  createMockAuthWebhookHandler,
  type MockAuthEvent,
  type MockAuthMiddlewareResponse,
  type MockAuthOptions,
} from "./auth.js";
export {
  createMockBillingPort,
  createMockBillingStore,
  createMockBillingWebhookHandler,
  mockBillingPayloads,
  type MockBillingPayloads,
  type MockBillingStore,
  type MockBillingWebhookOptions,
} from "./billing.js";
export { createMockEmailPort, type MockEmailPort, type MockEmailPortOptions } from "./email.js";
export {
  createMockAnalyticsPort,
  createMockFeatureFlagPort,
  type MockAnalyticsPort,
  type MockFeatureFlag,
  type MockFeatureFlagPortOptions,
  type MockIdentifyCall,
  type MockPageCall,
  type MockTrackCall,
} from "./analytics.js";
export { createMockJobQueue } from "./jobs.js";
export { createMockStoragePort } from "./storage.js";
export { createMockAIModelPort, type MockAIModelPortOptions } from "./ai-provider.js";
