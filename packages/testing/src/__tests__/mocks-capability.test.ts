import { describe, expect, it } from "vitest";
import { EmailErrorCode, EmailPortError } from "@forge/email";
import { AnalyticsErrorCode, AnalyticsPortError } from "@forge/analytics";
import { JobStatus } from "@forge/jobs";
import { StorageErrorCode, StoragePortError } from "@forge/storage";
import { AIErrorCode, AIModelPortError } from "@forge/ai-provider";
import {
  createMockAIModelPort,
  createMockAnalyticsPort,
  createMockEmailPort,
  createMockFeatureFlagPort,
  createMockJobQueue,
  createMockStoragePort,
  makeEmailMessage,
  makeStorageBytes,
} from "../index.js";

describe("createMockEmailPort", () => {
  it("records sent messages and issues sequential ids", async () => {
    const port = createMockEmailPort();
    const first = await port.send(makeEmailMessage());
    const second = await port.send(makeEmailMessage());

    expect(first.id).not.toBe(second.id);
    expect(port.sent()).toHaveLength(2);
  });

  it("rejects bodyless messages with EMAIL_SEND_FAILED", async () => {
    const port = createMockEmailPort();
    const error = await port
      .send(makeEmailMessage({ html: undefined, text: undefined }))
      .catch((caught: unknown) => caught);
    expect((error as EmailPortError).code).toBe(EmailErrorCode.SEND_FAILED);
  });

  it("rejects recipient-less messages with EMAIL_SEND_FAILED", async () => {
    const port = createMockEmailPort();
    const error = await port.send(makeEmailMessage({ to: [] })).catch((caught: unknown) => caught);
    expect((error as EmailPortError).code).toBe(EmailErrorCode.SEND_FAILED);
  });

  it("sendBatch is all-or-nothing and keeps input order", async () => {
    const port = createMockEmailPort();
    const result = await port.sendBatch([makeEmailMessage(), makeEmailMessage()]);
    expect(result.ids).toHaveLength(2);

    const batchError = await port
      .sendBatch([makeEmailMessage(), makeEmailMessage({ html: undefined, text: undefined })])
      .catch((caught: unknown) => caught);
    expect((batchError as EmailPortError).code).toBe(EmailErrorCode.SEND_FAILED);
    expect(port.sent()).toHaveLength(2); // the failed batch added nothing
  });

  it("failNextSend simulates one delivery failure", async () => {
    const port = createMockEmailPort({ failNextSend: true });
    const error = await port.send(makeEmailMessage()).catch((caught: unknown) => caught);
    expect((error as EmailPortError).code).toBe(EmailErrorCode.SEND_FAILED);
    await expect(port.send(makeEmailMessage())).resolves.toHaveProperty("id");
  });
});

describe("createMockAnalyticsPort", () => {
  it("records identify, track and page calls in order", () => {
    const port = createMockAnalyticsPort();
    port.identify("user_1", { plan: "pro" });
    port.track("scan_started", { source: "test" });
    port.track("scan_finished");
    port.page("dashboard");

    expect(port.identified).toEqual([{ userId: "user_1", traits: { plan: "pro" } }]);
    expect(port.tracked).toEqual([
      { event: "scan_started", properties: { source: "test" } },
      { event: "scan_finished", properties: undefined },
    ]);
    expect(port.pages).toEqual([{ name: "dashboard", properties: undefined }]);
  });
});

describe("createMockFeatureFlagPort", () => {
  it("evaluates configured flags and defaults unknown flags off", async () => {
    const flags = createMockFeatureFlagPort({
      flags: { beta: { enabled: true, variant: "treatment" }, off: { enabled: false } },
    });

    await expect(flags.isEnabled("beta")).resolves.toBe(true);
    await expect(flags.getVariant("beta")).resolves.toBe("treatment");
    await expect(flags.isEnabled("off")).resolves.toBe(false);
    await expect(flags.getVariant("off")).resolves.toBeNull();
    await expect(flags.isEnabled("unknown")).resolves.toBe(false);
  });

  it("fails evaluation with ANALYTICS_FLAG_EVALUATION_FAILED when configured", async () => {
    const flags = createMockFeatureFlagPort({ failEvaluation: true });
    const error = await flags.isEnabled("beta").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AnalyticsPortError);
    expect((error as AnalyticsPortError).code).toBe(AnalyticsErrorCode.FLAG_EVALUATION_FAILED);
  });
});

describe("createMockJobQueue", () => {
  it("runs processors with data and attempt counters", async () => {
    const queue = createMockJobQueue();
    const seen: Array<{ data: unknown; attempt: number }> = [];
    queue.registerProcessor<{ value: number }>("work", async (job) => {
      seen.push({ data: job.data, attempt: job.attempt });
    });
    await queue.start();

    const jobId = await queue.enqueue("work", { value: 7 });
    expect(seen).toEqual([{ data: { value: 7 }, attempt: 1 }]);
    expect((await queue.getJob(jobId))?.status).toBe(JobStatus.COMPLETED);
  });

  it("retries up to maxAttempts then fails with the recorded error", async () => {
    const queue = createMockJobQueue();
    queue.registerProcessor("flaky", async () => {
      throw new Error("boom");
    });
    await queue.start();

    const jobId = await queue.enqueue("flaky", {}, { maxAttempts: 3 });
    const info = await queue.getJob(jobId);
    expect(info?.status).toBe(JobStatus.FAILED);
    expect(info?.attempts).toBe(3);
    expect(info?.error).toBe("boom");
  });

  it("holds jobs without processors as pending and drains them on start", async () => {
    const queue = createMockJobQueue();
    await queue.start();
    const jobId = await queue.enqueue("later", { n: 1 });
    expect((await queue.getJob(jobId))?.status).toBe(JobStatus.PENDING);

    let ran = false;
    queue.registerProcessor("later", async () => {
      ran = true;
    });
    await queue.stop();
    await queue.start();
    expect(ran).toBe(true);
    expect((await queue.getJob(jobId))?.status).toBe(JobStatus.COMPLETED);
  });
});

describe("createMockStoragePort", () => {
  it("round-trips buffered and streamed uploads with metadata", async () => {
    const storage = createMockStoragePort();
    await storage.upload("a.txt", makeStorageBytes("hello"), "text/plain");

    async function* stream(): AsyncIterable<Uint8Array> {
      yield makeStorageBytes("he");
      yield makeStorageBytes("llo");
    }
    await storage.upload("b.txt", stream(), "text/plain");

    await expect(storage.download("a.txt")).resolves.toEqual(makeStorageBytes("hello"));
    await expect(storage.download("b.txt")).resolves.toEqual(makeStorageBytes("hello"));

    const listed = await storage.list("");
    expect(listed.map((object) => object.key)).toEqual(["a.txt", "b.txt"]);
    expect(listed[0].size).toBe(5);
    expect(listed[0].contentType).toBe("text/plain");
  });

  it("raises STORAGE_OBJECT_NOT_FOUND for unknown keys on download", async () => {
    const storage = createMockStoragePort();
    const error = await storage.download("missing").catch((caught: unknown) => caught);
    expect((error as StoragePortError).code).toBe(StorageErrorCode.OBJECT_NOT_FOUND);
  });

  it("produces deterministic signed urls", async () => {
    const storage = createMockStoragePort();
    await expect(storage.getSignedUrl("a.txt", 60)).resolves.toContain("a.txt");
    await expect(storage.getSignedUrl("a.txt", 60)).resolves.toContain("expiresIn=60");
  });
});

describe("createMockAIModelPort", () => {
  it("completes deterministically and attributes the model", async () => {
    const port = createMockAIModelPort({ defaultModel: "mock-default" });
    const first = await port.complete("hello");
    const second = await port.complete("hello");

    expect(first).toEqual(second);
    expect(first.model).toBe("mock-default");
    expect((await port.complete("hello", { model: "other" })).model).toBe("other");
  });

  it("validates structured output through the provided schema", async () => {
    const port = createMockAIModelPort({ structuredValue: { answer: 42 } });
    const schema = {
      parse(input: unknown): { answer: number } {
        const record = input as { answer?: unknown };
        if (typeof record?.answer !== "number") {
          throw new Error("answer must be a number");
        }
        return { answer: record.answer };
      },
    };

    await expect(port.completeStructured("question", schema)).resolves.toEqual({ answer: 42 });

    const strictSchema = { parse(): never { throw new Error("always rejects"); } };
    const error = await port.completeStructured("question", strictSchema).catch((caught: unknown) => caught);
    expect((error as AIModelPortError).code).toBe(AIErrorCode.STRUCTURED_OUTPUT_INVALID);
  });

  it("embeds deterministically", async () => {
    const port = createMockAIModelPort();
    await expect(port.embed("abc")).resolves.toEqual(await port.embed("abc"));
    await expect(port.embed("abc")).resolves.toHaveLength(3);
  });
});
