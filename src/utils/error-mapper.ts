import { Response } from "express";
import { logger } from "./logger";
import { ValidationErrors, ScraperErrors, AuthErrors, BaseAppError } from "../errors";
import { LOG_MESSAGES } from "../constants/log";

export function handleError(error: unknown, res: Response, source: string): void {
  if (error instanceof BaseAppError) {
    logger.error(source, error);
    
    if (error instanceof ValidationErrors.UrlEmptyError ||
        error instanceof ValidationErrors.DateEmptyError ||
        error instanceof ValidationErrors.InvalidDateFormatError ||
        error instanceof ValidationErrors.InvalidUrlFormatError) {
      res.status(400).json({
        error: error.code,
        message: error.message
      });
    } else if (error instanceof AuthErrors.UnauthorizedError ||
               error instanceof AuthErrors.ApiKeyMissingError) {
      res.status(401).json({
        error: error.code,
        message: error.message
      });
    } else if (error instanceof ScraperErrors.FetchFailedError ||
               error instanceof ScraperErrors.HtmlEmptyError) {
      res.status(502).json({
        error: error.code,
        message: error.message
      });
    } else {
      res.status(500).json({
        error: error.code,
        message: error.message
      });
    }
  } else if (error instanceof Error) {
    logger.error(source, error.message);
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: error.message
    });
  } else {
    logger.error(source, LOG_MESSAGES.UNKNOWN_ERROR);
    res.status(500).json({
      error: "UNKNOWN_ERROR",
      message: "An unknown error occurred"
    });
  }
}

