export type PerDeviceSplitGroup = {
  deviceFingerprint: string;
  label: string;
  itemIds: string[];
  subtotal: number;
};

export type PerDeviceSplitPlan = {
  mode: "by_device";
  groups: PerDeviceSplitGroup[];
};

type SplitItemRow = {
  id: string;
  product_name: string;
  total: number;
  device_fingerprint?: string | null;
};

/** per_device mode — one split share per ordering device (G3). */
export function buildPerDeviceSplitPlan(input: {
  items: SplitItemRow[];
  devices: Array<{ deviceFingerprint: string; displayName?: string | null }>;
  fallbackDeviceFingerprint?: string | null;
}): PerDeviceSplitPlan | null {
  if (input.items.length === 0 || input.devices.length < 2) return null;

  const groups = new Map<string, PerDeviceSplitGroup>();

  for (const item of input.items) {
    const fp =
      item.device_fingerprint?.trim().toLowerCase() ||
      input.fallbackDeviceFingerprint?.trim().toLowerCase() ||
      "unknown";
    const device = input.devices.find(
      (row) => row.deviceFingerprint.toLowerCase() === fp
    );
    const label =
      device?.displayName?.trim() ||
      (fp === "unknown" ? "Guest" : `Device ${fp.slice(0, 6)}`);

    const entry = groups.get(fp) ?? {
      deviceFingerprint: fp,
      label,
      itemIds: [],
      subtotal: 0,
    };
    entry.itemIds.push(item.id);
    entry.subtotal += Number(item.total);
    groups.set(fp, entry);
  }

  if (groups.size < 2) return null;

  return {
    mode: "by_device",
    groups: [...groups.values()].map((group) => ({
      ...group,
      subtotal: Math.round(group.subtotal * 100) / 100,
    })),
  };
}
