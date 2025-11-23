export class BaseAppError extends Error {
  static ERROR_PREFIX = "restaurantMenuSummarizer/";
  
  public code: string = "";
  public message: string = "";
  public meta?: Record<string, any>;

  constructor(meta?: Record<string, any>) {
    super();
    this.meta = meta;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
