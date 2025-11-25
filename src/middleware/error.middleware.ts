import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { BaseAppError, ValidationErrors, ScraperErrors, AuthErrors, LLMErrors, CacheErrors, MenuSchemaErrors } from "../errors";
import { LOG_SOURCES } from "../constants/log";

/**
 * Global Express error handler middleware
 * Catches all thrown errors and returns unified JSON response format
 * Detects custom error classes and maps them to appropriate HTTP status codes
 */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  // Handle custom application errors
  // Check both instanceof and error code (for cases where instanceof fails after async propagation)
  let errorCode: string | null = null;
  let errorMessage: string = '';
  let errorMeta: Record<string, any> = {};
  
  // Try to extract error code from various possible structures
  if (err instanceof BaseAppError) {
    errorCode = err.code;
    errorMessage = err.message;
    errorMeta = err.meta || {};
  } else if (err && typeof err === 'object' && err !== null) {
    const errObj = err as any;
    
    // Check for code property (most reliable check)
    const code = errObj.code;
    if (code && (typeof code === 'string' || typeof code === 'number')) {
      const codeStr = String(code);
      if (codeStr.startsWith(BaseAppError.ERROR_PREFIX)) {
        errorCode = codeStr;
        errorMessage = errObj.message || (err instanceof Error ? err.message : '') || '';
        errorMeta = errObj.meta || errObj.details || {};
      }
    }
  }
  
  if (errorCode) {
    const statusCode = getStatusCodeByCode(errorCode);
    const errorResponse = {
      error: {
        code: errorCode,
        message: errorMessage,
        details: errorMeta
      }
    };

    res.status(statusCode).json(errorResponse);
    return;
  }

  // Log unexpected errors for debugging
  logger.error(LOG_SOURCES.SERVER, err instanceof Error ? err.message : "Unknown error", {
    path: req.path,
    method: req.method,
    error: err
  });

  // Handle unexpected errors
  if (err instanceof Error) {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: err.message,
        details: { stack: err.stack }
      }
    });
    return;
  }

  // Handle unknown errors
  res.status(500).json({
    error: {
      code: "UNKNOWN_ERROR",
      message: "An unknown error occurred",
      details: {}
    }
  });
}

/**
 * Maps error codes to HTTP status codes
 * Uses code prefixes for reliability (works even if instanceof fails)
 */
function getStatusCodeByCode(errorCode: string): number {
  // Validation errors (400)
  if (errorCode.startsWith(`${BaseAppError.ERROR_PREFIX}validation/`)) {
    return 400;
  }

  // Authentication errors (401)
  if (errorCode.startsWith(`${BaseAppError.ERROR_PREFIX}auth/`)) {
    return 401;
  }

  // Scraper errors (502 - Bad Gateway)
  if (errorCode.startsWith(`${BaseAppError.ERROR_PREFIX}scraper/`)) {
    return 502;
  }

  // LLM errors (500)
  if (errorCode.startsWith(`${BaseAppError.ERROR_PREFIX}llm/`)) {
    return 500;
  }

  // Schema errors (500)
  if (errorCode.startsWith(`${BaseAppError.ERROR_PREFIX}menuSchema/`)) {
    return 500;
  }

  // Cache errors (500)
  if (errorCode.startsWith(`${BaseAppError.ERROR_PREFIX}cache/`)) {
    return 500;
  }

  // Default to 500 for unknown custom errors
  return 500;
}

