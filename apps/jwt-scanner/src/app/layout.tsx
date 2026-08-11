/**
 * Root layout (V3 §3.3, §10.3): applies the product theme via ThemeScope and
 * the generated globals.css, and sets the document language.
 */

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ThemeScope } from "@forge/ui";
import { jwtScannerTheme } from "@/theme/tokens";
import "../theme/globals.css";

export const metadata: Metadata = {
  title: "JWT Scanner — scan JWTs for security issues",
  description:
    "Analyze JWTs for algorithm-confusion and alg=none attacks, weak HMAC key policy, and expired claims. Export JSON, Markdown, and HTML reports.",
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, backgroundColor: "var(--forge-colors-surface-background)" }}>
        <ThemeScope tokens={jwtScannerTheme}>{children}</ThemeScope>
      </body>
    </html>
  );
}
