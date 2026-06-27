import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const GUEST_A11Y_FILES = [
  "src/components/guest/ai-concierge-chat.tsx",
  "src/components/guest/menu-view.tsx",
  "src/components/guest/checkout-form.tsx",
  "src/components/guest/order-status-tracker.tsx",
  "src/components/guest/order-bill-panel.tsx",
];

describe("Guest a11y patterns (AN1 static)", () => {
  for (const relPath of GUEST_A11Y_FILES) {
    it(`${relPath} includes live region or alert patterns`, () => {
      const source = readFileSync(path.join(process.cwd(), relPath), "utf8");
      const hasLiveOrAlert =
        source.includes("aria-live") ||
        source.includes('role="alert"') ||
        source.includes('role="log"') ||
        source.includes("aria-label");
      expect(hasLiveOrAlert).toBe(true);
    });
  }

  it("order status tracker uses semantic step list", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/guest/order-status-tracker.tsx"),
      "utf8"
    );
    expect(source).toContain('aria-current={current ? "step"');
    expect(source).toContain("<ol");
  });

  it("ai concierge chat announces cart changes", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/guest/ai-concierge-chat.tsx"),
      "utf8"
    );
    expect(source).toContain('role="log"');
    expect(source).toContain("cartAnnouncement");
  });

  it("menu list item avoids nested interactive controls", () => {
    const listItem = readFileSync(
      path.join(process.cwd(), "src/components/guest/menu-list-item.tsx"),
      "utf8"
    );
    expect(listItem).not.toMatch(/role="button"/);
    expect(listItem).not.toContain("tabIndex={0}");
    expect(listItem).toContain("onOpenDetail={onOpenDetail}");

    const productRow = readFileSync(
      path.join(
        process.cwd(),
        "src/components/design-system/guest-product-row.tsx"
      ),
      "utf8"
    );
    expect(productRow).toContain("onOpenDetail?: () => void");
  });

  it("guest accent controls meet contrast-safe selected styles", () => {
    for (const relPath of [
      "src/components/guest/category-pills.tsx",
      "src/components/guest/language-toggle.tsx",
    ]) {
      const source = readFileSync(path.join(process.cwd(), relPath), "utf8");
      expect(source).not.toContain("bg-orange-500 text-white");
      expect(source).toContain("bg-orange-700 text-white");
    }
  });
});
