const { USER_STATUSES } = require("../config/constants");
const HttpError = require("../utils/httpError");

function activeUserMiddleware(req, res, next) {
  if (!req.user) {
    return next(new HttpError(401, "Требуется авторизация."));
  }

  if (req.user.status !== USER_STATUSES.ACTIVE) {
    return next(new HttpError(403, "Аккаунт заблокирован. Доступ к этому разделу ограничен."));
  }

  next();
}

module.exports = activeUserMiddleware;
