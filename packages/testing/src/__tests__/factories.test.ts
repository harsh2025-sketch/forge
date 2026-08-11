import { describe, expect, it } from "vitest";
import { isSubscriptionStatus } from "@forge/billing";
import { isJobStatus } from "@forge/jobs";
import {
  FACTORY_TIMESTAMP,
  makeAnalyticsProperties,
  makeAnalyticsTraits,
  makeAuthOrganization,
  makeAuthUser,
  makeBillingCustomer,
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
} from "../index.js";

describe("auth factories", () => {
  it("makeAuthUser produces unique, fully populated users", () => {
    const first = makeAuthUser();
    const second = makeAuthUser();

    expect(first.id).not.toBe(second.id);
    expect(first.email).not.toBe(second.email);
    expect(first.id).not.toBe("");
    expect(first.email).toContain("@");
    expect(typeof first.name).toBe("string");
  });

  it("makeAuthUser applies overrides", () => {
    const user = makeAuthUser({ id: "user_fixed", email: "fixed@example.test", name: undefined });
    expect(user).toEqual({ id: "user_fixed", email: "fixed@example.test", name: undefined });
  });

  it("makeAuthOrganization produces unique organizations with slugs", () => {
    const first = makeAuthOrganization();
    const second = makeAuthOrganization();

    expect(first.id).not.toBe(second.id);
    expect(first.name).not.toBe("");
    expect(first.slug).not.toBe("");
  });
});

describe("billing factories", () => {
  it("makeBillingCustomer and subscription produce valid values", () => {
    const customer = makeBillingCustomer();
    const subscription = makeBillingSubscription({ customerId: customer.id });

    expect(customer.id).not.toBe("");
    expect(subscription.customerId).toBe(customer.id);
    expect(isSubscriptionStatus(subscription.status)).toBe(true);
  });

  it("param builders produce complete inputs", () => {
    expect(makeCreateCustomerParams().email).toContain("@");
    const checkout = makeCreateCheckoutParams();
    expect(checkout.successUrl).not.toBe("");
    expect(checkout.cancelUrl).not.toBe("");
    expect(makeReportUsageParams().quantity).toBeGreaterThan(0);
    const plan = makePlan();
    expect(plan.entitlements.length).toBeGreaterThan(0);
    expect(makeEntitlement().key).not.toBe("");
  });
});

describe("email factories", () => {
  it("makeEmailMessage produces a valid message with both bodies", () => {
    const message = makeEmailMessage();
    expect(message.html).not.toBeUndefined();
    expect(message.text).not.toBeUndefined();
    expect(message.subject).not.toBe("");

    const other = makeEmailMessage();
    expect(other.subject).not.toBe(message.subject);
  });

  it("makeEmailAddress produces a named mailbox", () => {
    const address = makeEmailAddress();
    expect(address.email).toContain("@");
    expect(address.name).not.toBe("");
  });
});

describe("analytics factories", () => {
  it("produce deterministic, serializable records", () => {
    const properties = makeAnalyticsProperties();
    const traits = makeAnalyticsTraits();
    expect(JSON.parse(JSON.stringify(properties))).toEqual(properties);
    expect(JSON.parse(JSON.stringify(traits))).toEqual(traits);
    expect(makeAnalyticsProperties().sequence).not.toBe(properties.sequence);
  });
});

describe("jobs factories", () => {
  it("makeJob produces a first-attempt job with data", () => {
    const job = makeJob();
    expect(job.attempt).toBe(1);
    expect(job.id).not.toBe("");
    expect(job.name).not.toBe("");
  });

  it("makeJobInfo produces a valid pending info record", () => {
    const info = makeJobInfo();
    expect(isJobStatus(info.status)).toBe(true);
    expect(info.createdAt).toBe(FACTORY_TIMESTAMP);
  });

  it("makeJobOptions produces delivery options", () => {
    const options = makeJobOptions();
    expect(options.maxAttempts).toBeGreaterThan(0);
  });
});

describe("storage factories", () => {
  it("makeStorageObject produces a listing entry", () => {
    const object = makeStorageObject();
    expect(object.key).not.toBe("");
    expect(object.size).toBeGreaterThan(0);
  });

  it("makeStorageBytes encodes deterministically", () => {
    expect(makeStorageBytes("abc")).toEqual(makeStorageBytes("abc"));
    expect(makeStorageBytes().byteLength).toBeGreaterThan(0);
  });
});

describe("ai-provider factories", () => {
  it("produce complete completion records", () => {
    const result = makeCompletionResult();
    expect(result.text).not.toBe("");
    expect(result.usage?.totalTokens).toBe(
      (result.usage?.promptTokens ?? 0) + (result.usage?.completionTokens ?? 0)
    );
    expect(makeCompletionOptions().model).not.toBe("");
    expect(makeTokenUsage().totalTokens).toBeGreaterThan(0);
  });

  it("makeEmbedding produces a deterministic vector of the requested length", () => {
    expect(makeEmbedding(4)).toHaveLength(4);
    expect(makeEmbedding(4)).toEqual(makeEmbedding(4));
  });
});
