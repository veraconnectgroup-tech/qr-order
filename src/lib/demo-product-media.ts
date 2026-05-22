/** Stock photos + allergen labels for demo menu items */
export const DEMO_PRODUCT_MEDIA: Record<
  string,
  { imageUrl: string; allergens?: string[] }
> = {
  "Aperol Spritz": {
    imageUrl:
      "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&q=80",
    allergens: ["sulfites"],
  },
  "Negroni": {
    imageUrl:
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&q=80",
    allergens: ["sulfites"],
  },
  "Espresso Martini": {
    imageUrl:
      "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=600&q=80",
    allergens: ["sulfites"],
  },
  "Hugo Spritz": {
    imageUrl:
      "https://images.unsplash.com/photo-1541544187151-7d73e83e6f9f?w=600&q=80",
    allergens: ["sulfites"],
  },
  "Truffle Fries": {
    imageUrl:
      "https://images.unsplash.com/photo-1573080496216-bf07096c9673?w=600&q=80",
    allergens: ["gluten", "dairy"],
  },
  Nachos: {
    imageUrl:
      "https://images.unsplash.com/photo-1513458032977-3c3f35676546?w=600&q=80",
    allergens: ["gluten", "dairy"],
  },
};

export function getDemoProductMedia(name: string) {
  return DEMO_PRODUCT_MEDIA[name];
}
