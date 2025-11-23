import { BaseAppError } from "./BaseAppError";

const MENU_SCHEMA_ERROR_PREFIX = `${BaseAppError.ERROR_PREFIX}menuSchema/`;

export const MenuSchemaErrors = {
  InvalidSchemaError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${MENU_SCHEMA_ERROR_PREFIX}invalidSchema`;
      this.message = "LLM output did not match MenuResponse schema";
    }
  },
};

