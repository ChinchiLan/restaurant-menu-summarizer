import { BaseAppError } from "./BaseAppError";

const CACHE_ERROR_PREFIX = `${BaseAppError.ERROR_PREFIX}cache/`;

export const CacheErrors = {
  NotInitializedError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${CACHE_ERROR_PREFIX}notInitialized`;
      this.message = "Cache not initialized. Call init() first.";
    }
  },

  InitFailedError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${CACHE_ERROR_PREFIX}initFailed`;
      this.message = "Failed to initialize cache database";
    }
  },

  ReadFailedError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${CACHE_ERROR_PREFIX}readFailed`;
      this.message = "Failed to get cached menu";
    }
  },

  WriteFailedError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${CACHE_ERROR_PREFIX}writeFailed`;
      this.message = "Failed to save menu to cache";
    }
  },

  InvalidateFailedError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${CACHE_ERROR_PREFIX}invalidateFailed`;
      this.message = "Failed to invalidate old records";
    }
  },

  CloseFailedError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${CACHE_ERROR_PREFIX}closeFailed`;
      this.message = "Failed to close database";
    }
  },
};

