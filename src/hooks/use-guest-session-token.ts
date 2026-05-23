"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/hooks/use-cart";
import { useGuestSession } from "@/hooks/use-guest-session";

function bothStoresHydrated() {
  return (
    useGuestSession.persist.hasHydrated() && useCart.persist.hasHydrated()
  );
}

/**
 * Single session token for guest API calls. Prefers guest session, falls back
 * to cart session (they can desync when navigating cart → checkout directly).
 */
export function useGuestSessionToken() {
  const guestToken = useGuestSession((s) => s.sessionToken);
  const cartToken = useCart((s) => s.sessionToken);
  const cartSlug = useCart((s) => s.restaurantSlug);
  const cartTableToken = useCart((s) => s.tableToken);
  const cartTableName = useCart((s) => s.tableName);
  const setGuestSession = useGuestSession((s) => s.setSession);
  const [hydrated, setHydrated] = useState(bothStoresHydrated);

  useEffect(() => {
    function markHydrated() {
      if (bothStoresHydrated()) setHydrated(true);
    }

    markHydrated();
    const unsubGuest = useGuestSession.persist.onFinishHydration(markHydrated);
    const unsubCart = useCart.persist.onFinishHydration(markHydrated);
    return () => {
      unsubGuest();
      unsubCart();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const guest = useGuestSession.getState();
    const cart = useCart.getState();

    if (!guest.sessionToken && cart.sessionToken) {
      setGuestSession({
        sessionId: guest.sessionId ?? "",
        sessionToken: cart.sessionToken,
        tableId: guest.tableId,
        tableName: guest.tableName ?? cart.tableName,
        locationId: guest.locationId,
        restaurantSlug: guest.restaurantSlug ?? cart.restaurantSlug,
      });
      return;
    }

    if (
      guest.sessionToken &&
      cart.sessionToken !== guest.sessionToken &&
      guest.restaurantSlug === cart.restaurantSlug &&
      guest.tableId
    ) {
      cart.setSession(
        guest.restaurantSlug ?? cart.restaurantSlug ?? "",
        cart.tableToken ?? "",
        guest.tableName ?? cart.tableName ?? "",
        guest.sessionToken
      );
    }
  }, [hydrated, guestToken, cartToken, cartSlug, cartTableName, setGuestSession]);

  return {
    sessionToken: guestToken ?? cartToken,
    hydrated,
  };
}
