export const MENU_SECTIONS = ["drinks", "food", "desserts"] as const;
export type MenuSection = (typeof MENU_SECTIONS)[number];

export const MENU_SECTION_LABELS: Record<MenuSection, string> = {
  drinks: "Drinks",
  food: "Food",
  desserts: "Desserts",
};

export function isMenuSection(value: string): value is MenuSection {
  return (MENU_SECTIONS as readonly string[]).includes(value);
}

export function inferMenuSection(category: {
  name: string;
  name_en?: string | null;
  menu_section?: string | null;
}): MenuSection {
  if (category.menu_section && isMenuSection(category.menu_section)) {
    return category.menu_section;
  }

  const label = (category.name_en ?? category.name).toLowerCase();
  if (
    /drink|cocktail|wine|beer|spirit|beverage|bar\b|coffee|pić|pica|pivo|vino/.test(
      label
    )
  ) {
    return "drinks";
  }
  if (/dessert|sweet|cake|pastry|dezert|slatki|sladoled/.test(label)) {
    return "desserts";
  }
  return "food";
}

export function orderPlacedMessage(sections: MenuSection[]): string {
  const unique = [...new Set(sections)];
  if (unique.length === 1) {
    switch (unique[0]) {
      case "drinks":
        return "Drinks order sent!";
      case "desserts":
        return "Dessert order sent!";
      case "food":
        return "Order sent to kitchen!";
    }
  }
  return "Order placed!";
}
