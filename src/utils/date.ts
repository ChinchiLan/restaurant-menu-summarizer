import { ValidationErrors } from "../errors";

const CZECH_DAY_NAMES = [
  "Neděle",
  "Pondělí",
  "Úterý",
  "Středa",
  "Čtvrtek",
  "Pátek",
  "Sobota"
];

export function getCzechDayName(dateString: string): string {
  const parsedDate = new Date(dateString);
  
  if (isNaN(parsedDate.getTime())) {
    throw new ValidationErrors.InvalidDateFormatError({ date: dateString });
  }
  
  const dayIndex = parsedDate.getDay();
  return CZECH_DAY_NAMES[dayIndex];
}
