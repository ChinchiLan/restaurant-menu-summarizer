import { BaseAppError } from "./BaseAppError";

const LLM_ERROR_PREFIX = `${BaseAppError.ERROR_PREFIX}llm/`;

export const LLMErrors = {
  ApiKeyMissingError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${LLM_ERROR_PREFIX}apiKeyMissing`;
      this.message = "Missing OPENAI_API_KEY. Set it in .env";
    }
  },

  InvalidJsonError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${LLM_ERROR_PREFIX}invalidJson`;
      this.message = "Invalid JSON returned from LLM";
    }
  },

  ExtractionFailedError: class extends BaseAppError {
    constructor(meta?: Record<string, any>) {
      super(meta);
      this.code = `${LLM_ERROR_PREFIX}extractionFailed`;
      this.message = "LLM extraction failed";
    }
  },
};

