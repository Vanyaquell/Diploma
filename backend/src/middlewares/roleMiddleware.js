const HttpError = require("../utils/httpError");

function roleMiddleware(...allowedRoles) {
  return function requireRole(req, res, next) {
    if (!req.user) {
      return next(new HttpError(401, "Требуется авторизация."));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new HttpError(403, "Доступ запрещён."));
    }

    next();
  };
}

module.exports = roleMiddleware;
