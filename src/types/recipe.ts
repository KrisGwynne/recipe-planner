/* Generated from schema/recipe.schema.json by `npm run schema:types`. Do not edit. */

export type Protein =
  | {
      category: "meat";
      item: "chicken" | "turkey" | "duck" | "beef" | "pork" | "lamb" | "game" | "other";
      /**
       * e.g. "thighs", "chorizo", "mince"
       */
      detail?: string;
    }
  | {
      category: "fish";
      item: "salmon" | "tuna" | "white-fish" | "mackerel" | "smoked-fish" | "prawns" | "mussels" | "squid" | "other";
      /**
       * e.g. "cod", "tinned", "hot-smoked"
       */
      detail?: string;
    }
  | {
      category: "vegetarian";
      item: "tofu" | "tempeh" | "beans-pulses" | "egg" | "cheese" | "meat-substitute" | "nuts-seeds" | "other";
      /**
       * e.g. "chickpeas", "halloumi", "Quorn"
       */
      detail?: string;
    };
export type DietaryFlag = "vegetarian" | "vegan" | "gluten-free" | "dairy-free" | "nut-free";
/**
 * Proteins in this variation, if they differ from the main recipe.
 */
export type Proteins = Protein[];
/**
 * Strict suitability of this variation.
 */
export type Dietary = DietaryFlag[];

/**
 * A single recipe, produced by Claude from a photo of a printed recipe and imported into the meal-planning app. schema_version 1.
 */
export interface Recipe {
  schema_version: 1;
  /**
   * Stable slug, lowercase and hyphenated. Re-importing a file with the same id updates that recipe.
   */
  id: string;
  /**
   * Recipe name as printed.
   */
  name: string;
  /**
   * Optional short summary in Claude's own words.
   */
  description?: string;
  source: RecipeSource;
  /**
   * Number of portions the ingredient quantities make.
   */
  serves: number;
  times: RecipeTimes;
  difficulty: "easy" | "medium" | "hard";
  /**
   * @minItems 1
   */
  meal_type: ("breakfast" | "lunch" | "dinner" | "side" | "snack" | "dessert" | "baking" | "drink")[];
  cuisine:
    | "british"
    | "irish"
    | "french"
    | "italian"
    | "spanish"
    | "portuguese"
    | "greek"
    | "mediterranean"
    | "middle-eastern"
    | "north-african"
    | "african"
    | "indian"
    | "chinese"
    | "japanese"
    | "korean"
    | "thai"
    | "vietnamese"
    | "south-east-asian"
    | "mexican"
    | "american"
    | "caribbean"
    | "latin-american"
    | "fusion"
    | "other";
  /**
   * Main carbohydrate base(s). Either ["none"] or one or more of the others.
   */
  carbs: "none"[] | ("pasta" | "noodles" | "rice" | "potato" | "bread" | "grains" | "pastry")[];
  /**
   * Free text specifics, e.g. "rigatoni", "udon", "sweet potato".
   */
  carb_detail?: string;
  /**
   * The main protein(s) the dish is built around, not minor ingredients (a sprinkle of parmesan is not a protein). Empty array if there is none. Category is enforced by item.
   */
  proteins: Protein[];
  /**
   * Strict suitability of the recipe AS WRITTEN (main version, not variations). Only include a flag if every ingredient qualifies.
   */
  dietary: DietaryFlag[];
  equipment: (
    | "hob"
    | "oven"
    | "grill"
    | "microwave"
    | "air-fryer"
    | "slow-cooker"
    | "pressure-cooker"
    | "bbq"
    | "food-processor"
    | "blender"
    | "stand-mixer"
  )[];
  storage: RecipeStorage;
  spice_level: "none" | "mild" | "medium" | "hot";
  /**
   * Free-form extra labels, lowercase and hyphenated. Not used for core filtering.
   */
  tags: string[];
  /**
   * @minItems 1
   */
  ingredients: Ingredient[];
  /**
   * @minItems 1
   */
  method: MethodStep[];
  variations: Variation[];
  nutrition_per_serving: Nutrition;
  /**
   * Optional tips or serving suggestions from the recipe, in Claude's own words.
   */
  notes?: string;
}
export interface RecipeSource {
  kind: "book" | "magazine" | "website" | "family" | "other";
  /**
   * Book or magazine name, website name, or person for family recipes.
   */
  title: string;
  /**
   * Issue, chapter, page, e.g. "September 2021, p63".
   */
  details?: string;
  url?: string;
}
export interface RecipeTimes {
  prep_mins: number;
  cook_mins: number;
  /**
   * Hands-off waiting not already in cook time: marinating, chilling, proving, resting. Use the minimum if the recipe says "or longer".
   */
  wait_mins: number;
  notes?: string;
}
export interface RecipeStorage {
  /**
   * null if unknown.
   */
  freezable: boolean | null;
  /**
   * Reheats or keeps well for another meal. null if unknown.
   */
  good_for_leftovers: boolean | null;
  notes?: string;
}
export interface Ingredient {
  /**
   * Sub-recipe the ingredient belongs to, e.g. "char siu sauce".
   */
  group?: string;
  /**
   * Ingredient name only, singular where natural, e.g. "red onion".
   */
  item: string;
  /**
   * Decimal amount (0.5 for half). null for "to taste".
   */
  qty: number | null;
  /**
   * null for whole countable items (1 red onion, 0.5 lemon).
   */
  unit:
    | null
    | "g"
    | "kg"
    | "ml"
    | "l"
    | "tsp"
    | "tbsp"
    | "cup"
    | "pinch"
    | "handful"
    | "bunch"
    | "can"
    | "jar"
    | "pack"
    | "clove"
    | "slice"
    | "sprig"
    | "sheet"
    | "piece";
  /**
   * Optional total weight in grams when the unit is a container or non-metric, e.g. 2 x 110g cans -> 220.
   */
  grams?: number;
  /**
   * e.g. "finely chopped", "drained".
   */
  prep?: string;
  /**
   * Anything else, e.g. "heaped", "small", "350g in step 1, 150g in step 3".
   */
  notes?: string;
  optional?: boolean;
  /**
   * Shopping-list grouping.
   */
  aisle:
    | "fruit-veg"
    | "meat"
    | "fish"
    | "dairy-eggs"
    | "bakery"
    | "chilled"
    | "frozen"
    | "tins-jars"
    | "dried-goods"
    | "herbs-spices"
    | "oils-sauces"
    | "drinks"
    | "other";
}
export interface MethodStep {
  /**
   * One step, as a full sentence.
   */
  text: string;
  /**
   * Optional timer for this step.
   */
  timer_mins?: number;
}
export interface Variation {
  /**
   * Short label, e.g. "Veggie".
   */
  name: string;
  description: string;
  proteins?: Proteins;
  dietary?: Dietary;
}
export interface Nutrition {
  source: "printed" | "estimated";
  kcal: number;
  fat_g: number;
  saturates_g: number;
  carbs_g: number;
  sugars_g: number;
  fibre_g: number;
  protein_g: number;
  salt_g: number;
}
