import { BaseAppError } from "./BaseAppError";

const SCRAPER_ERROR_PREFIX = `${BaseAppError.ERROR_PREFIX}scraper/`;

export const ScraperErrors = {
  FetchFailedError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${SCRAPER_ERROR_PREFIX}fetchFailed`;
      this.message = "Failed to fetch URL";
    }
  },

  HtmlEmptyError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${SCRAPER_ERROR_PREFIX}htmlEmpty`;
      this.message = "Empty HTML response";
    }
  },
};

