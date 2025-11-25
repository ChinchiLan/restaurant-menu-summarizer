/**
 * Retry utility with exponential backoff
 * Retries failed operations with increasing delays between attempts
 * Only retries on network errors or 5xx server errors
 */

import axios from "axios";

export interface RetryOptions {
  retries?: number;
  delay?: number;
  factor?: number;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { retries = 3, delay = 300, factor = 2 } = options;
  
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on last attempt
      if (attempt === retries) {
        break;
      }
      
      // Only retry on network/5xx errors
      if (!shouldRetry(error)) {
        throw error;
      }
      
      // Calculate exponential backoff delay
      const backoffDelay = delay * Math.pow(factor, attempt);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  throw lastError;
}

/**
 * Determines if an error should trigger a retry
 * Retries only on network errors or 5xx server errors
 */
function shouldRetry(error: unknown): boolean {
  // Check for axios errors (network or 5xx)
  if (axios.isAxiosError(error)) {
    // Network errors (no response)
    if (!error.response) {
      return true;
    }
    
    // 5xx server errors
    if (error.response.status >= 500) {
      return true;
    }
    
    // Network error codes
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
  }
  
  // Check for OpenAI API errors (5xx)
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: number }).status;
    if (status && status >= 500) {
      return true;
    }
  }
  
  return false;
}

