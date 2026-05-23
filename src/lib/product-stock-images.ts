/** Curated Unsplash stock photos for Skyline Lounge seed products (verified HTTP 200). */

const W = 600;
const Q = 80;

export function unsplashUrl(photoId: string): string {
  return `https://images.unsplash.com/${photoId}?w=${W}&q=${Q}`;
}

export type ProductStockImage = {
  productId: string;
  name: string;
  photoId: string;
  imageUrl: string;
  allergens?: string[];
};

const PHOTOS = {
  aperolSpritz: "photo-1758218058958-78f40a716c20",
  negroni: "photo-1514362545857-3bc16c4c7d1b",
  espressoMartini: "photo-1544145945-f90425340c7e",
  hugoSpritz: "photo-1556679343-c7306c1976bc",
  mojito: "photo-1572116469696-31de0f17cc34",
  whiskey: "photo-1558642452-9d2a7deb7f62",
  prosecco: "photo-1553361371-9b22f78e8b1d",
  whiteWine: "photo-1547595628-c61a29f496f0",
  craftBeer: "photo-1436076863939-06870fe779c2",
  draftBeer: "photo-1535958636474-b021ee887b13",
  lemonade: "photo-1541167760496-1628856ab772",
  sparklingWater: "photo-1602143407151-7111542de6e8",
  cola: "photo-1559339352-11d035aa65de",
  espresso: "photo-1495474472287-4d71bcdd2085",
  fries: "photo-1551782450-a2132b4ba21d",
  nachos: "photo-1555939594-58d7cb561ad1",
  charcuterie: "photo-1504674900247-0877df9cc836",
  bruschetta: "photo-1571091718767-18b5b1457add",
  tiramisu: "photo-1563805042-7684c019e1cb",
  cheesecake: "photo-1551218808-94e220e084d2",
  lavaCake: "photo-1567620905732-2d1ec7ab7445",
} as const;

function entry(
  productId: string,
  name: string,
  photoId: string,
  allergens?: string[]
): ProductStockImage {
  return {
    productId,
    name,
    photoId,
    imageUrl: unsplashUrl(photoId),
    allergens,
  };
}

/** All seed product images keyed by product UUID. */
export const PRODUCT_STOCK_IMAGES: Record<string, ProductStockImage> = {
  "f0000000-0000-4000-8000-000000000001": entry(
    "f0000000-0000-4000-8000-000000000001",
    "Aperol Spritz",
    PHOTOS.aperolSpritz,
    ["sulfites"]
  ),
  "f0000000-0000-4000-8000-000000000002": entry(
    "f0000000-0000-4000-8000-000000000002",
    "Negroni",
    PHOTOS.negroni,
    ["sulfites"]
  ),
  "f0000000-0000-4000-8000-000000000003": entry(
    "f0000000-0000-4000-8000-000000000003",
    "Espresso Martini",
    PHOTOS.espressoMartini,
    ["sulfites"]
  ),
  "f0000000-0000-4000-8000-000000000004": entry(
    "f0000000-0000-4000-8000-000000000004",
    "Hugo Spritz",
    PHOTOS.hugoSpritz,
    ["sulfites"]
  ),
  "f0000000-0000-4000-8000-000000000005": entry(
    "f0000000-0000-4000-8000-000000000005",
    "Mojito",
    PHOTOS.mojito,
    ["sulfites"]
  ),
  "f0000000-0000-4000-8000-000000000006": entry(
    "f0000000-0000-4000-8000-000000000006",
    "Old Fashioned",
    PHOTOS.whiskey,
    ["sulfites"]
  ),
  "f0000000-0000-4000-8000-000000000007": entry(
    "f0000000-0000-4000-8000-000000000007",
    "Gin & Tonic",
    PHOTOS.hugoSpritz,
    ["sulfites"]
  ),
  "f0000000-0000-4000-8000-000000000008": entry(
    "f0000000-0000-4000-8000-000000000008",
    "Whiskey Sour",
    PHOTOS.espressoMartini,
    ["sulfites"]
  ),
  "f0000000-0000-4000-8000-000000000009": entry(
    "f0000000-0000-4000-8000-000000000009",
    "Prosecco DOC",
    PHOTOS.prosecco,
    ["sulfites"]
  ),
  "f0000000-0000-4000-8000-000000000010": entry(
    "f0000000-0000-4000-8000-000000000010",
    "Pinot Grigio",
    PHOTOS.whiteWine,
    ["sulfites"]
  ),
  "f0000000-0000-4000-8000-000000000011": entry(
    "f0000000-0000-4000-8000-000000000011",
    "Malbec Reserva",
    PHOTOS.negroni,
    ["sulfites"]
  ),
  "f0000000-0000-4000-8000-000000000012": entry(
    "f0000000-0000-4000-8000-000000000012",
    "Craft IPA",
    PHOTOS.craftBeer,
    ["gluten"]
  ),
  "f0000000-0000-4000-8000-000000000013": entry(
    "f0000000-0000-4000-8000-000000000013",
    "Pilsner",
    PHOTOS.draftBeer,
    ["gluten"]
  ),
  "f0000000-0000-4000-8000-000000000014": entry(
    "f0000000-0000-4000-8000-000000000014",
    "Radler",
    PHOTOS.draftBeer,
    ["gluten"]
  ),
  "f0000000-0000-4000-8000-000000000015": entry(
    "f0000000-0000-4000-8000-000000000015",
    "Fresh Lemonade",
    PHOTOS.lemonade
  ),
  "f0000000-0000-4000-8000-000000000016": entry(
    "f0000000-0000-4000-8000-000000000016",
    "Sparkling Water",
    PHOTOS.sparklingWater
  ),
  "f0000000-0000-4000-8000-000000000017": entry(
    "f0000000-0000-4000-8000-000000000017",
    "Cola",
    PHOTOS.cola
  ),
  "f0000000-0000-4000-8000-000000000018": entry(
    "f0000000-0000-4000-8000-000000000018",
    "Espresso",
    PHOTOS.espresso
  ),
  "f0000000-0000-4000-8000-000000000019": entry(
    "f0000000-0000-4000-8000-000000000019",
    "Truffle Fries",
    PHOTOS.fries,
    ["gluten", "dairy"]
  ),
  "f0000000-0000-4000-8000-000000000020": entry(
    "f0000000-0000-4000-8000-000000000020",
    "Nachos Supreme",
    PHOTOS.nachos,
    ["gluten", "dairy"]
  ),
  "f0000000-0000-4000-8000-000000000021": entry(
    "f0000000-0000-4000-8000-000000000021",
    "Charcuterie Board",
    PHOTOS.charcuterie,
    ["dairy"]
  ),
  "f0000000-0000-4000-8000-000000000022": entry(
    "f0000000-0000-4000-8000-000000000022",
    "Bruschetta Trio",
    PHOTOS.bruschetta,
    ["gluten", "dairy"]
  ),
  "f0000000-0000-4000-8000-000000000023": entry(
    "f0000000-0000-4000-8000-000000000023",
    "Tiramisu",
    PHOTOS.tiramisu,
    ["gluten", "dairy", "eggs"]
  ),
  "f0000000-0000-4000-8000-000000000024": entry(
    "f0000000-0000-4000-8000-000000000024",
    "Cheesecake",
    PHOTOS.cheesecake,
    ["gluten", "dairy", "eggs"]
  ),
  "f0000000-0000-4000-8000-000000000025": entry(
    "f0000000-0000-4000-8000-000000000025",
    "Chocolate Lava Cake",
    PHOTOS.lavaCake,
    ["gluten", "dairy", "eggs"]
  ),
};

const BY_NAME = Object.values(PRODUCT_STOCK_IMAGES).reduce<
  Record<string, ProductStockImage>
>((acc, item) => {
  acc[item.name] = item;
  return acc;
}, {});

/** Lookup by display name (demo landing page). */
export function getProductStockImage(name: string): ProductStockImage | undefined {
  return BY_NAME[name] ?? BY_NAME[name.replace(/^Nachos$/, "Nachos Supreme")];
}
