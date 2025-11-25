import { MenuItem } from "../services/llm.service";
import { MenuPreferences, SummarizeInput } from "../validators/summarize.schema";

export type SummarizeRequest = SummarizeInput;

export type { MenuPreferences };

export interface RestaurantMenu {
  restaurant_name: string;
  date: string;
  day_of_week: string;
  menu_items: MenuItem[];
  daily_menu: boolean;
  recommendedMeal: string | null;
}

export type SummarizeResponse = RestaurantMenu;

