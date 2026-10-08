export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "ApiError";
  }

  static badRequest(message: string, code = "BAD_REQUEST"): ApiError {
    return new ApiError(400, code, message);
  }

  static unauthorized(message = "Authentication required", code = "UNAUTHORIZED"): ApiError {
    return new ApiError(401, code, message);
  }

  static forbidden(message = "You do not have permission to perform this action", code = "FORBIDDEN"): ApiError {
    return new ApiError(403, code, message);
  }

  static notFound(message = "Resource not found", code = "NOT_FOUND"): ApiError {
    return new ApiError(404, code, message);
  }

  static conflict(message: string, code = "CONFLICT"): ApiError {
    return new ApiError(409, code, message);
  }

  static internal(message = "Something went wrong", code = "INTERNAL_ERROR"): ApiError {
    return new ApiError(500, code, message);
  }
}
