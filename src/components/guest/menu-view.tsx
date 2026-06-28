"use client";

import { MenuViewShell } from "@/components/guest/menu-view/menu-view-shell";
import type { MenuViewProps } from "@/components/guest/menu-view/props";
import { useMenuView } from "@/hooks/use-menu-view";

export type { MenuViewProps } from "@/components/guest/menu-view/props";

export function MenuView(props: MenuViewProps) {
  const state = useMenuView(props);
  return <MenuViewShell props={props} state={state} />;
}
