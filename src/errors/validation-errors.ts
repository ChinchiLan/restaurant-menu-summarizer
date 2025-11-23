import { BaseAppError } from "./BaseAppError";

const VALIDATION_ERROR_PREFIX = `${BaseAppError.ERROR_PREFIX}validation/`;

export const ValidationErrors = {
  UrlEmptyError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${VALIDATION_ERROR_PREFIX}urlEmpty`;
      this.message = "url must be a non-empty string";
    }
  },

  DateEmptyError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${VALIDATION_ERROR_PREFIX}dateEmpty`;
      this.message = "date must be a non-empty string";
    }
  },

  InvalidDateFormatError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${VALIDATION_ERROR_PREFIX}invalidDateFormat`;
      this.message = "date must be in YYYY-MM-DD format";
    }
  },

  InvalidUrlFormatError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${VALIDATION_ERROR_PREFIX}invalidUrlFormat`;
      this.message = "url must be a valid HTTP/HTTPS URL";
    }
  },

  InvalidUrlArrayError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${VALIDATION_ERROR_PREFIX}invalidUrlArray`;
      this.message = "url must be a non-empty string or array of strings";
    }
  },
};

