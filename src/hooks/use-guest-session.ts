import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GuestSession {
  sessionId: string | null;
  sessionToken: string | null;
  tableId: string | null;
  tableName: string | null;
  locationId: string | null;
  restaurantSlug: string | null;

  setSession: (data: Omit<GuestSession, "setSession" | "clearSession">) => void;
  clearSession: () => void;
}

export const useGuestSession = create<GuestSession>()(
  persist(
    (set) => ({
      sessionId: null,
      sessionToken: null,
      tableId: null,
      tableName: null,
      locationId: null,
      restaurantSlug: null,

      setSession: (data) => set(data),
      clearSession: () =>
        set({
          sessionId: null,
          sessionToken: null,
          tableId: null,
          tableName: null,
          locationId: null,
          restaurantSlug: null,
        }),
    }),
    { name: "qr-guest-session" }
  )
);
