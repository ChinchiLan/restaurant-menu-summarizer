import { z } from "zod";

const urlStringSchema = z
  .string()
  .trim()
  .min(1, "URL cannot be empty")
  .refine(
    (val) => val.startsWith("http://") || val.startsWith("https://"),
    { message: "URL must start with http:// or https://" }
  );

export const MenuPreferencesSchema = z.object({
  price: z.number().positive().optional(),
  allergens: z.array(z.number().int()).optional()
}).optional();

export const SummarizeInputSchema = z.object({
  url: urlStringSchema,
  date: z
    .string()
    .trim()
    .min(1, "date cannot be empty")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format")
    .refine(
      (val) => {
        const parsed = new Date(val);
        return !isNaN(parsed.getTime());
      },
      { message: "date must be a valid date" }
    ),
  preferences: MenuPreferencesSchema
});

export type MenuPreferences = z.infer<typeof MenuPreferencesSchema>;
export type SummarizeInput = z.infer<typeof SummarizeInputSchema>;

