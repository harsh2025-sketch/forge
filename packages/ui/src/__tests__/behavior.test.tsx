/**
 * Interactive behavior tests for primitives/composites (jsdom + createRoot +
 * act). Covers real click/change wiring: Tabs onSelect, Toggle onToggle,
 * Checkbox onChange and Pagination onPageChange.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import type { ReactElement } from "react";
import { Tabs } from "../primitives/tabs.js";
import { Toggle } from "../primitives/toggle.js";
import { Checkbox } from "../primitives/checkbox.js";
import { Pagination } from "../composites/pagination.js";

function renderToContainer(element: ReactElement): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    createRoot(container).render(element);
  });
  return container;
}

function click(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("Tabs behavior", () => {
  it("calls onSelect with the clicked tab id", () => {
    const onSelect = vi.fn();
    const container = renderToContainer(
      <Tabs
        items={[
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ]}
        activeId="a"
        onSelect={onSelect}
      />
    );

    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(2);

    click(tabs[1]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("b");

    click(tabs[0]);
    expect(onSelect).toHaveBeenCalledWith("a");
  });
});

describe("Toggle behavior", () => {
  it("calls onToggle with the negated checked state", () => {
    const onToggle = vi.fn();
    const container = renderToContainer(<Toggle checked={false} label="Enable" onToggle={onToggle} />);

    const toggle = container.querySelector('[role="switch"]');
    expect(toggle).not.toBeNull();

    click(toggle!);
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});

describe("Checkbox behavior", () => {
  it("fires onChange with the new checked state", () => {
    const onChange = vi.fn();
    const container = renderToContainer(
      <Checkbox label="Agree" onChange={(event) => onChange(event.currentTarget.checked)} />
    );

    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    act(() => {
      input.click();
    });
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("Pagination behavior", () => {
  it("calls onPageChange with adjacent pages", () => {
    const onPageChange = vi.fn();
    const container = renderToContainer(
      <Pagination page={3} pageSize={10} total={100} onPageChange={onPageChange} />
    );

    const next = container.querySelector(".forge-pagination-next") as HTMLButtonElement;
    click(next);
    expect(onPageChange).toHaveBeenCalledWith(4);

    const previous = container.querySelector(".forge-pagination-previous") as HTMLButtonElement;
    click(previous);
    expect(onPageChange).toHaveBeenCalledWith(2);

    const pageTwo = [...container.querySelectorAll(".forge-pagination-page")].find(
      (button) => button.textContent === "2"
    );
    click(pageTwo!);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("does not fire when Previous is disabled on the first page", () => {
    const onPageChange = vi.fn();
    const container = renderToContainer(
      <Pagination page={1} pageSize={10} total={100} onPageChange={onPageChange} />
    );

    const previous = container.querySelector(".forge-pagination-previous") as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    click(previous);
    expect(onPageChange).not.toHaveBeenCalled();
  });
});
