import { Request, Response, NextFunction } from "express";
import { requireApiKey } from "../../src/middleware/auth.middleware";
import { AuthErrors } from "../../src/errors";

describe("Auth Middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const originalEnv = process.env.API_KEY;

  beforeEach(() => {
    process.env.API_KEY = "test-api-key-12345";
    
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock }));
    
    req = {
      headers: {},
      ip: "127.0.0.1",
      path: "/api/summarize"
    };
    
    res = {
      status: statusMock as any,
      json: jsonMock
    };
    
    next = jest.fn();
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.API_KEY = originalEnv;
    } else {
      delete process.env.API_KEY;
    }
  });

  it("should call next() with valid API key in x-api-key header", () => {
    req.headers = { 'x-api-key': 'test-api-key-12345' };

    requireApiKey(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(statusMock).not.toHaveBeenCalled();
  });

  it("should call next() with valid API key in Authorization Bearer header", () => {
    req.headers = { 'authorization': 'Bearer test-api-key-12345' };

    requireApiKey(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(statusMock).not.toHaveBeenCalled();
  });

  it("should return 401 when API key is missing", () => {
    req.headers = {};

    requireApiKey(req as Request, res as Response, next);

    // Auth middleware now uses next(error) to pass to global error handler
    expect(next).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const errorArg = (next as jest.Mock).mock.calls[0][0];
    expect(errorArg.code).toBe("restaurantMenuSummarizer/auth/apiKeyMissing");
    expect(errorArg.message).toBe("API key is required");
  });

  it("should return 401 when API key is invalid", () => {
    req.headers = { 'x-api-key': 'wrong-api-key' };

    requireApiKey(req as Request, res as Response, next);

    // Auth middleware now uses next(error) to pass to global error handler
    expect(next).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const errorArg = (next as jest.Mock).mock.calls[0][0];
    expect(errorArg.code).toBe("restaurantMenuSummarizer/auth/unauthorized");
    expect(errorArg.message).toBe("Invalid or missing API key");
  });

  it("should return 500 when API_KEY is not configured in environment", () => {
    delete process.env.API_KEY;
    req.headers = { 'x-api-key': 'some-key' };

    requireApiKey(req as Request, res as Response, next);

    // When API_KEY not configured, middleware passes generic error to handler
    expect(next).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const errorArg = (next as jest.Mock).mock.calls[0][0];
    expect(errorArg.message).toBe("API key not configured on server");
  });

  it("should prefer x-api-key header over Authorization header", () => {
    req.headers = {
      'x-api-key': 'test-api-key-12345',
      'authorization': 'Bearer wrong-key'
    };

    requireApiKey(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(statusMock).not.toHaveBeenCalled();
  });

  it("should reject Authorization header without Bearer prefix", () => {
    req.headers = { 'authorization': 'test-api-key-12345' };

    requireApiKey(req as Request, res as Response, next);

    // Auth middleware now uses next(error) to pass to global error handler
    expect(next).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const errorArg = (next as jest.Mock).mock.calls[0][0];
    expect(errorArg.code).toBe("restaurantMenuSummarizer/auth/apiKeyMissing");
  });

  it("should reject empty API key", () => {
    req.headers = { 'x-api-key': '' };

    requireApiKey(req as Request, res as Response, next);

    // Auth middleware now uses next(error) to pass to global error handler
    expect(next).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const errorArg = (next as jest.Mock).mock.calls[0][0];
    expect(errorArg.code).toBe("restaurantMenuSummarizer/auth/apiKeyMissing");
  });
});

