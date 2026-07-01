export type MenuImportItem = {
  name: string;
  description?: string | null;
  price: number;
  category: string;
  allergens?: string[];
};

export type MenuCategoryHint = {
  id: string;
  name: string;
  menu_section: string;
};

export type ParsedMenuImport = {
  items: MenuImportItem[];
  warnings: string[];
  categoriesUsed: string[];
};
