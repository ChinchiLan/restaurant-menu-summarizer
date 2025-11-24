import { BaseAppError } from "./BaseAppError";

const AUTH_ERROR_PREFIX = `${BaseAppError.ERROR_PREFIX}auth/`;

export const AuthErrors = {
  UnauthorizedError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${AUTH_ERROR_PREFIX}unauthorized`;
      this.message = "Invalid or missing API key";
    }
  },

  ApiKeyMissingError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${AUTH_ERROR_PREFIX}apiKeyMissing`;
      this.message = "API key is required";
    }
  },
};

