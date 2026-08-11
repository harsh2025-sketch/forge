/**
 * Optional PDF wrapper tests. Never launches a real browser: a fake launcher is
 * injected, so ordinary reporting tests require no live browser (V3 §20.2
 * Day 8: "Puppeteer PDF wrapper as optional").
 */

import { describe, it, expect, vi } from "vitest";
import { renderPdf } from "../generators/pdf.js";
import type { PdfBrowser, PdfLauncher, PdfPage } from "../generators/pdf.js";

const FAKE_BYTES = new Uint8Array([37, 80, 68, 70, 1, 2, 3]); // "%PDF..." prefix

interface FakePageState {
  setContent: ReturnType<typeof vi.fn>;
  pdf: ReturnType<typeof vi.fn>;
}

interface FakeBrowserState {
  newPage: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function createFakeBrowser(html: string, pdfResult: Uint8Array = FAKE_BYTES): {
  pageState: FakePageState;
  browserState: FakeBrowserState;
  launcher: PdfLauncher;
} {
  const setContent = vi.fn(async () => undefined);
  const pdf = vi.fn(async () => pdfResult);
  const page: PdfPage = { setContent, pdf };

  const newPage = vi.fn(async () => page);
  const close = vi.fn(async () => undefined);
  const browser: PdfBrowser = { newPage, close };

  const launch = vi.fn(async () => browser);
  const launcher: PdfLauncher = { launch };

  return { pageState: { setContent, pdf }, browserState: { newPage, close }, launcher };
}

describe("renderPdf", () => {
  it("renders HTML to PDF bytes through the injected launcher", async () => {
    const html = "<!doctype html><html><body><h1>Report</h1></body></html>";
    const { pageState, browserState, launcher } = createFakeBrowser(html);

    const result = await renderPdf(html, { launcher });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value).toEqual(FAKE_BYTES);
    expect(pageState.setContent).toHaveBeenCalledWith(html, { waitUntil: "networkidle0" });
    expect(pageState.pdf).toHaveBeenCalledWith({
      format: "a4",
      printBackground: true,
    });
    expect(browserState.close).toHaveBeenCalledTimes(1);
  });

  it("passes format/margin/printBackground options through deterministically", async () => {
    const html = "<html><body>x</body></html>";
    const { pageState, launcher } = createFakeBrowser(html);

    const result = await renderPdf(html, {
      launcher,
      format: "letter",
      printBackground: false,
      margin: { top: "5mm", bottom: "5mm", left: "10mm", right: "10mm" },
    });

    expect(result.ok).toBe(true);
    expect(pageState.pdf).toHaveBeenCalledWith({
      format: "letter",
      printBackground: false,
      margin: { top: "5mm", bottom: "5mm", left: "10mm", right: "10mm" },
    });
  });

  it("passes executablePath/browserWSEndpoint to the launcher when supplied", async () => {
    const html = "<html><body>x</body></html>";
    const { launcher } = createFakeBrowser(html);

    await renderPdf(html, { launcher, executablePath: "/usr/bin/chromium", browserWSEndpoint: "ws://remote" });

    expect(launcher.launch).toHaveBeenCalledWith({
      executablePath: "/usr/bin/chromium",
      browserWSEndpoint: "ws://remote",
    });
  });

  it("returns a typed error when the launcher fails (no throw)", async () => {
    const html = "<html><body>x</body></html>";
    const failingLauncher: PdfLauncher = {
      launch: vi.fn(async () => {
        throw new Error("Chrome executable not found");
      }),
    };

    const result = await renderPdf(html, { launcher: failingLauncher });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("Chrome executable not found");
    expect(result.error).toContain("renderPdf failed");
  });

  it("returns a typed error when page.pdf fails", async () => {
    const html = "<html><body>x</body></html>";
    const setContent = vi.fn(async () => undefined);
    const pdf = vi.fn(async () => {
      throw new Error("Printing failed");
    });
    const page: PdfPage = { setContent, pdf };
    const close = vi.fn(async () => undefined);
    const browser: PdfBrowser = { newPage: async () => page, close };
    const launcher: PdfLauncher = { launch: async () => browser };

    const result = await renderPdf(html, { launcher });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Printing failed");
    }
  });

  it("swallows browser close failures after success (best-effort cleanup)", async () => {
    const html = "<html><body>x</body></html>";
    const setContent = vi.fn(async () => undefined);
    const pdf = vi.fn(async () => FAKE_BYTES);
    const page: PdfPage = { setContent, pdf };
    const close = vi.fn(async () => {
      throw new Error("close failed");
    });
    const browser: PdfBrowser = { newPage: async () => page, close };
    const launcher: PdfLauncher = { launch: async () => browser };

    const result = await renderPdf(html, { launcher });
    expect(result.ok).toBe(true);
  });

  it("rejects empty/whitespace html up front", async () => {
    const { launcher } = createFakeBrowser("<html></html>");
    const empty = await renderPdf("", { launcher });
    expect(empty.ok).toBe(false);
    const whitespace = await renderPdf("   \n ", { launcher });
    expect(whitespace.ok).toBe(false);
    // No browser should have been launched for invalid input.
    expect(launcher.launch).not.toHaveBeenCalled();
  });
});
