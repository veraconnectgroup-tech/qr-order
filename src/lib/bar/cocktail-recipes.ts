export type CocktailRecipeStep = {
  label: string;
  detail?: string;
};

export type CocktailRecipeCard = {
  productName: string;
  steps: CocktailRecipeStep[];
  ingredients: string[];
  missingIngredients: string[];
  is86: boolean;
};

type RecipeDefinition = {
  ingredients: string[];
  steps: CocktailRecipeStep[];
  unavailableIngredients?: string[];
};

const RECIPES: Record<string, RecipeDefinition> = {
  negroni: {
    ingredients: ["gin", "campari", "sweet vermouth", "orange peel"],
    steps: [
      { label: "Build", detail: "30ml gin, 30ml Campari, 30ml vermouth" },
      { label: "Stir", detail: "Ice, 20s, strain rocks" },
      { label: "Garnish", detail: "Orange peel express" },
    ],
  },
  mojito: {
    ingredients: ["white rum", "lime", "mint", "sugar", "soda"],
    steps: [
      { label: "Muddle", detail: "Mint + lime + sugar" },
      { label: "Build", detail: "50ml rum, top soda" },
      { label: "Garnish", detail: "Mint sprig" },
    ],
  },
  aperol: {
    ingredients: ["aperol", "prosecco", "soda", "orange slice"],
    steps: [
      { label: "Build", detail: "3-2-1 Aperol : Prosecco : Soda" },
      { label: "Garnish", detail: "Orange slice" },
    ],
  },
  margarita: {
    ingredients: ["tequila", "triple sec", "lime juice", "salt"],
    steps: [
      { label: "Shake", detail: "50ml tequila, 20ml triple sec, 25ml lime" },
      { label: "Serve", detail: "Salt rim, coupe" },
    ],
    unavailableIngredients: ["triple sec"],
  },
};

function recipeKey(name: string): string | null {
  const normalized = name.toLowerCase();
  if (normalized.includes("negroni")) return "negroni";
  if (normalized.includes("mojito")) return "mojito";
  if (normalized.includes("aperol") || normalized.includes("spritz")) return "aperol";
  if (normalized.includes("margarita")) return "margarita";
  if (normalized.includes("cocktail")) return "negroni";
  return null;
}

export function getCocktailRecipeCard(productName: string): CocktailRecipeCard | null {
  const key = recipeKey(productName);
  if (!key) return null;

  const recipe = RECIPES[key];
  const missingIngredients = recipe.unavailableIngredients ?? [];
  return {
    productName,
    steps: recipe.steps,
    ingredients: recipe.ingredients,
    missingIngredients,
    is86: missingIngredients.length > 0,
  };
}
