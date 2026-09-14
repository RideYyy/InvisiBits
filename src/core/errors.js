export class AppError extends Error {
  constructor(message, code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

export function ensure(condition, message, code) {
  if (!condition) {
    throw new AppError(message, code);
  }
}
