import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  FloorTile,
  floorTileStatusFromTable,
} from "@/components/design-system";

describe("FloorTile", () => {
  it("applies available dashed border classes for floor variant", () => {
    render(
      <FloorTile
        as="button"
        variant="floor"
        status="available"
        label="T8"
        sublabel="4 seats"
      />
    );

    const tile = screen.getByRole("button", { name: "T8" });
    expect(tile.className).toContain("border-dashed");
    expect(tile.className).toContain("border-dash-surface-overlay");
  });

  it("applies occupied ember top bar classes for floor variant", () => {
    render(
      <FloorTile
        as="button"
        variant="floor"
        status="occupied"
        label="T1"
        sublabel="2 seats"
      />
    );

    const tile = screen.getByRole("button", { name: "T1" });
    expect(tile.className).toContain("border-emerald-500/40");
    expect(tile.className).toContain("before:bg-[var(--qr-ember)]");
    expect(tile.className).toContain("spatial-tile-occupy");
  });

  it("enforces 44px minimum height for chip variant", () => {
    render(<FloorTile variant="chip" label="Potvrdi" as="button" />);

    const chip = screen.getByRole("button", { name: "Potvrdi" });
    expect(chip.className).toContain("min-h-11");
  });

  it("exposes accessible name from label when rendered as button", () => {
    render(
      <FloorTile as="button" variant="floor" label="VIP 1" sublabel="6 seats" />
    );

    expect(screen.getByRole("button", { name: "VIP 1" })).toBeInTheDocument();
  });
});

describe("floorTileStatusFromTable", () => {
  const base = {
    hasWaiterCall: false,
    hasPaymentRequest: false,
    session: null,
    activeOrders: [] as unknown[],
  };

  it("maps waiter call to attention", () => {
    expect(
      floorTileStatusFromTable({ ...base, hasWaiterCall: true })
    ).toBe("attention");
  });

  it("maps payment request to payment", () => {
    expect(
      floorTileStatusFromTable({ ...base, hasPaymentRequest: true })
    ).toBe("payment");
  });

  it("maps active session to occupied", () => {
    expect(
      floorTileStatusFromTable({ ...base, session: { id: "s1" } })
    ).toBe("occupied");
  });

  it("defaults to available", () => {
    expect(floorTileStatusFromTable(base)).toBe("available");
  });
});
