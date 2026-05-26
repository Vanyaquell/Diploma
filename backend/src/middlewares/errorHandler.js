const HttpError = require("../utils/httpError");

function notFoundHandler(req, res, next) {
  next(new HttpError(404, `Маршрут ${req.method} ${req.originalUrl} не найден.`));
}

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  const payload = {
    message: error.message || "Внутренняя ошибка сервера.",
  };

  if (error.details) {
    payload.details = error.details;
  }

  if (process.env.NODE_ENV !== "production" && error.stack) {
    payload.stack = error.stack;
  }

  res.status(statusCode).json(payload);
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
