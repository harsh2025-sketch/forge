/**
 * ThemeScope must establish inheritable surface color so dark-theme products
 * do not render browser-default black headings on a dark background.
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { ThemeScope } from "../theme/scope.js";
import { contrastingTheme, defaultTheme } from "../theme/defaults.js";

describe("ThemeScope", () => {
  it("applies inheritable foreground color and background from tokens", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      createRoot(container).render(
        <ThemeScope tokens={contrastingTheme}>
          <h1>Heading</h1>
        </ThemeScope>,
      );
    });

    const scope = container.querySelector("[data-forge-theme='true']") as HTMLElement;
    expect(scope).not.toBeNull();
    expect(scope.style.color.length).toBeGreaterThan(0);
    expect(scope.style.backgroundColor.length).toBeGreaterThan(0);
    expect(scope.style.fontFamily.length).toBeGreaterThan(0);
    expect(scope.style.getPropertyValue("--forge-colors-surface-foreground")).toBe(
      contrastingTheme.colors.surface.foreground,
    );
    expect(scope.style.getPropertyValue("--forge-colors-surface-background")).toBe(
      contrastingTheme.colors.surface.background,
    );
  });

  it("renders different inheritable colors for contrasting token sets", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      createRoot(container).render(
        <>
          <ThemeScope tokens={defaultTheme} id="light">
            Light
          </ThemeScope>
          <ThemeScope tokens={contrastingTheme} id="dark">
            Dark
          </ThemeScope>
        </>,
      );
    });

    const light = container.querySelector("#light") as HTMLElement;
    const dark = container.querySelector("#dark") as HTMLElement;
    expect(light.style.color).not.toBe(dark.style.color);
    expect(light.style.backgroundColor).not.toBe(dark.style.backgroundColor);
  });
});
