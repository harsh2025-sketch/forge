/**
 * @forge/reporting — optional HTML → PDF wrapper (V3 §3.2 generators/pdf.ts,
 * §20.2 Day 8: "Puppeteer PDF wrapper as optional").
 *
 * Design constraints honoured:
 *  - thin wrapper around HTML report output; it does NOT render reports itself
 *  - Puppeteer is isolated as an OPTIONAL dependency (puppeteer-core) and is
 *    imported dynamically, only when renderPdf() is actually called — the core
 *    JSON/Markdown/HTML pipeline never touches a browser
 *  - no live browser is required for ordinary reporting tests: a launcher can be
 *    injected (PdfRenderOptions.launcher) and failures surface as a typed
 *    Result<Uint8Array, string>, never as a thrown browser exception
 *  - deterministic options mapping; no environment reads here
 */

import { err, ok } from "@forge/shared";
import type { Result } from "@forge/shared";

/** Minimal structural contract the wrapper needs from a browser page. */
export interface PdfPage {
  setContent(html: string, options?: { waitUntil?: string }): Promise<void>;
  pdf(options?: Record<string, unknown>): Promise<Uint8Array>;
}

/** Minimal structural contract the wrapper needs from a browser instance. */
export interface PdfBrowser {
  newPage(): Promise<PdfPage>;
  close(): Promise<void>;
}

/** Launches a headless browser (injectable so tests never need a live browser). */
export interface PdfLauncher {
  launch(options?: Record<string, unknown>): Promise<PdfBrowser>;
}

export interface PdfMargin {
  readonly top?: string;
  readonly bottom?: string;
  readonly left?: string;
  readonly right?: string;
}

export interface PdfRenderOptions {
  /** Page format; defaults to "a4". */
  readonly format?: "a4" | "letter";
  /** Whether background graphics are printed; defaults to true. */
  readonly printBackground?: boolean;
  /** Page margins, passed through to the browser as-is. */
  readonly margin?: PdfMargin;
  /** Path to a browser executable (puppeteer-core launch option). */
  readonly executablePath?: string;
  /** Remote browser endpoint (puppeteer-core launch option). */
  readonly browserWSEndpoint?: string;
  /**
   * Injectable launcher — used by tests and by products that manage their own
   * browser lifecycle. Defaults to a puppeteer-core launcher.
   */
  readonly launcher?: PdfLauncher;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

interface PuppeteerLike {
  launch(options: Record<string, unknown>): Promise<unknown>;
}

/**
 * Loads the optional puppeteer-core launcher. Called lazily, only when no
 * launcher was injected. Never statically imported so the core pipeline has no
 * browser dependency.
 */
async function loadPuppeteerLauncher(): Promise<PdfLauncher> {
  try {
    // Supports both CJS-interop (default export) and named-export ESM shapes.
    const module = (await import("puppeteer-core")) as {
      readonly launch?: (options: Record<string, unknown>) => Promise<unknown>;
      readonly default?: { readonly launch: (options: Record<string, unknown>) => Promise<unknown> };
    };
    const launch: PuppeteerLike["launch"] | undefined = module.launch ?? module.default?.launch;
    if (typeof launch !== "function") {
      throw new Error("puppeteer-core did not expose a launch() function");
    }
    const launchFn: PuppeteerLike["launch"] = launch;
    return {
      launch: (options = {}) => launchFn(options) as Promise<PdfBrowser>,
    };
  } catch (error) {
    throw new Error(
      `Puppeteer is not available (${errorMessage(error)}). Install "puppeteer-core" (optional dependency of @forge/reporting) or inject a PdfRenderOptions.launcher.`
    );
  }
}

/**
 * Renders an HTML string to PDF bytes. Thin, optional, isolated — never part of
 * the synchronous JSON/Markdown/HTML pipeline.
 */
export async function renderPdf(html: string, options: PdfRenderOptions = {}): Promise<Result<Uint8Array, string>> {
  if (typeof html !== "string" || html.trim().length === 0) {
    return err("renderPdf: html must be a non-empty string");
  }

  let browser: PdfBrowser | undefined;
  try {
    const launcher = options.launcher ?? (await loadPuppeteerLauncher());
    const launchOptions: Record<string, unknown> = {};
    if (options.executablePath !== undefined) {
      launchOptions.executablePath = options.executablePath;
    }
    if (options.browserWSEndpoint !== undefined) {
      launchOptions.browserWSEndpoint = options.browserWSEndpoint;
    }

    browser = await launcher.launch(launchOptions);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfOptions: Record<string, unknown> = {
      format: options.format ?? "a4",
      printBackground: options.printBackground ?? true,
    };
    if (options.margin !== undefined) {
      pdfOptions.margin = options.margin;
    }

    const bytes = await page.pdf(pdfOptions);
    return ok(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  } catch (error) {
    return err(`renderPdf failed: ${errorMessage(error)}`);
  } finally {
    if (browser !== undefined) {
      await browser.close().catch(() => {
        /* best-effort cleanup; the original result is preserved */
      });
    }
  }
}
