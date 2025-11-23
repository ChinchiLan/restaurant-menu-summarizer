import { BaseAppError } from "../errors";

type LogLevel = "debug" | "info" | "warn" | "error" | "system";

const SENSITIVE_KEYS = ["apikey", "token", "authorization", "password", "secret"];

function maskSensitiveValue(key: string): boolean {
  return SENSITIVE_KEYS.some(sensitive => key.toLowerCase().includes(sensitive));
}

function formatMetadata(metadata?: Record<string, any>): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "";
  }

  const sortedKeys = Object.keys(metadata).sort();
  const pairs = sortedKeys.map(key => {
    const value = maskSensitiveValue(key) ? "***" : metadata[key];
    return `${key}=${value}`;
  });

  return " | " + pairs.join(" | ");
}

function shouldLog(level: LogLevel): boolean {
  const currentLevel = process.env.LOG_LEVEL || "info";
  
  if (level === "debug") {
    return currentLevel === "debug";
  }
  
  return true;
}

function log(level: LogLevel, source: string, message: string, metadata?: Record<string, any>): void {
  if (!shouldLog(level)) {
    return;
  }

  const levelStr = level.toUpperCase();
  const sourceStr = source ? `[${source.toUpperCase()}] ` : "";
  const metadataStr = formatMetadata(metadata);

  console.log(`[${levelStr}] ${sourceStr}${message}${metadataStr}`);
}

export const logger = {
  info(source: string, message: string, metadata?: Record<string, any>): void {
    log("info", source, message, metadata);
  },

  warn(source: string, message: string, metadata?: Record<string, any>): void {
    log("warn", source, message, metadata);
  },

  error(source: string, messageOrError: string | BaseAppError | Error, metadata?: Record<string, any>): void {
    if (messageOrError instanceof BaseAppError) {
      const combinedMeta = { ...messageOrError.meta, ...metadata, code: messageOrError.code };
      log("error", source, messageOrError.message, combinedMeta);
    } else if (messageOrError instanceof Error) {
      log("error", source, messageOrError.message, metadata);
    } else {
      log("error", source, messageOrError, metadata);
    }
  },

  debug(source: string, message: string, metadata?: Record<string, any>): void {
    log("debug", source, message, metadata);
  },

  system(message: string, metadata?: Record<string, any>): void {
    log("system", "", message, metadata);
  }
};
