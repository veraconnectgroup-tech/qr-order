export type PartyMode = "shared_cart" | "per_device";

export type PartyDeviceRow = {
  deviceFingerprint: string;
  aiSessionId: string | null;
  displayName: string | null;
  isPrimary: boolean;
  manualCartRevision: number;
  manualCartSnapshot: unknown;
  lastActiveAt: string;
};

export type PartyOrderRow = {
  id: string;
  status?: string;
  createdAt: string;
  deviceFingerprint?: string | null;
  items: Array<{ productName: string; quantity: number }>;
};

export type TablePartyModel = {
  tableSessionId: string;
  partyMode: PartyMode;
  sharedAiSessionId: string | null;
  devices: PartyDeviceRow[];
  activeDeviceCount: number;
  currentDeviceFingerprint: string | null;
  isCurrentDevicePrimary: boolean;
};

export type RegisterPartyDeviceResult = {
  deviceId: string;
  isPrimary: boolean;
  sharedAiSessionId: string | null;
};
