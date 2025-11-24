import { MenuItem } from "../services/llm.service";
import { MenuPreferences, SummarizeInput } from "../validators/summarize.schema";

export type SummarizeRequest = SummarizeInput;

export type { MenuPreferences };

export interface RestaurantMenu {
  restaurant_name: string;
  date: string;
  day_of_week: string;
  menu_items: MenuItem[];
  extraction_status: "success" | "no_daily_menu";
  recommendedMeal: string | null;
}

export type SummarizeResponse = RestaurantMenu;

