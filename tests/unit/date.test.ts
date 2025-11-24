import { getCzechDayName } from "../../src/utils/date";
import { ValidationErrors } from "../../src/errors";

describe("date.ts - getCzechDayName()", () => {
  it("should return correct Czech weekday names", () => {
    expect(getCzechDayName("2025-11-24")).toBe("Pondělí");   // Monday
    expect(getCzechDayName("2025-11-26")).toBe("Středa");    // Wednesday
    expect(getCzechDayName("2025-11-28")).toBe("Pátek");     // Friday
    expect(getCzechDayName("2025-11-23")).toBe("Neděle");    // Sunday
  });

  it("should throw InvalidDateFormatError for invalid date string", () => {
    expect(() => getCzechDayName("invalid-date")).toThrow(ValidationErrors.InvalidDateFormatError);
  });

  it("should throw InvalidDateFormatError for malformed date", () => {
    expect(() => getCzechDayName("2025-13-45")).toThrow(ValidationErrors.InvalidDateFormatError);
  });

  it("should throw InvalidDateFormatError for empty string", () => {
    expect(() => getCzechDayName("")).toThrow(ValidationErrors.InvalidDateFormatError);
  });
});

