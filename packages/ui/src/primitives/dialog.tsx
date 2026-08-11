/**
 * @forge/ui — Dialog primitive (V3 §10.3). Structural overlay; scrim color is
 * a theme variable (`--forge-overlay`), never hard-coded branding.
 */

import type { CSSProperties, ReactNode } from "react";
import { tokenVar } from "../theme/apply.js";
import { cn } from "../classnames.js";

export interface DialogProps {
  readonly title?: string;
  readonly id?: string;
  readonly onClose?: () => void;
  readonly children?: ReactNode;
  readonly className?: string;
}

export function Dialog({ title, id, onClose, children, className }: DialogProps) {
  const titleId = id ?? "forge-dialog-title";

  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--forge-overlay)",
    zIndex: 50,
  };

  const panelStyle: CSSProperties = {
    backgroundColor: tokenVar(["colors", "surface", "background"]),
    color: tokenVar(["colors", "surface", "foreground"]),
    borderRadius: "var(--forge-borders-radius)",
    boxShadow: "var(--forge-shadows)",
    padding: "calc(var(--forge-spacing-unit) * 5)",
    width: "min(28rem, 90vw)",
    maxHeight: "80vh",
    overflow: "auto",
  };

  return (
    <div className={cn("forge-dialog-overlay", className)} style={overlayStyle} role="presentation">
      <div
        className="forge-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        style={panelStyle}
      >
        {title !== undefined && (
          <header
            className="forge-dialog-header"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "calc(var(--forge-spacing-unit) * 2)" }}
          >
            <h2
              id={titleId}
              style={{
                margin: 0,
                fontFamily: "var(--forge-typography-font-family-sans)",
                fontWeight: "var(--forge-typography-heading-weight)",
                fontSize: "calc(var(--forge-typography-font-size) * 1.125)",
              }}
            >
              {title}
            </h2>
            {onClose !== undefined && (
              <button
                type="button"
                className="forge-dialog-close"
                onClick={onClose}
                aria-label="Close dialog"
                style={{
                  border: "none",
                  background: "transparent",
                  color: tokenVar(["colors", "surface", "mutedForeground"]),
                  fontSize: "calc(var(--forge-typography-font-size) * 1.25)",
                  cursor: "pointer",
                  lineHeight: 1,
                  padding: "calc(var(--forge-spacing-unit) * 1)",
                }}
              >
                ×
              </button>
            )}
          </header>
        )}
        <div className="forge-dialog-body">{children}</div>
      </div>
    </div>
  );
}
