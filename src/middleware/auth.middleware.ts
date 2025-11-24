import { Request, Response, NextFunction } from "express";
import { AuthErrors } from "../errors";
import { logger } from "../utils/logger";
import { LOG_SOURCES, LOG_MESSAGES } from "../constants/log";

/**
 * Middleware to require API key authentication
 * Accepts API key via:
 * - x-api-key header
 * - Authorization: Bearer <key> header
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  try {
    // Check x-api-key header
    let apiKey = req.headers['x-api-key'] as string | undefined;
    
    // Check Authorization: Bearer header if x-api-key not present
    if (!apiKey) {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
      }
    }
    
    // No API key provided
    if (!apiKey) {
      logger.warn(LOG_SOURCES.AUTH, LOG_MESSAGES.API_KEY_MISSING, { 
        ip: req.ip,
        path: req.path 
      });
      throw new AuthErrors.ApiKeyMissingError();
    }
    
    // Validate API key
    const validApiKey = process.env.API_KEY;
    
    if (!validApiKey) {
      logger.error(LOG_SOURCES.AUTH, LOG_MESSAGES.API_KEY_NOT_CONFIGURED);
      res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "API key not configured on server"
      });
      return;
    }
    
    if (apiKey !== validApiKey) {
      logger.warn(LOG_SOURCES.AUTH, LOG_MESSAGES.API_KEY_INVALID, { 
        ip: req.ip,
        path: req.path 
      });
      throw new AuthErrors.UnauthorizedError();
    }
    
    // Success
    logger.debug(LOG_SOURCES.AUTH, LOG_MESSAGES.API_KEY_VALID, { path: req.path });
    next();
    
  } catch (error) {
    if (error instanceof AuthErrors.ApiKeyMissingError) {
      res.status(401).json({
        error: error.code,
        message: error.message
      });
      return;
    }
    
    if (error instanceof AuthErrors.UnauthorizedError) {
      res.status(401).json({
        error: error.code,
        message: error.message
      });
      return;
    }
    
    // Unexpected error
    logger.error(LOG_SOURCES.AUTH, "Unexpected error in auth middleware");
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Authentication error"
    });
  }
}

