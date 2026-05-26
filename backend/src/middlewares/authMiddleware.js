const jwt = require("jsonwebtoken");

const env = require("../config/env");
const userRepository = require("../models/userRepository");
const HttpError = require("../utils/httpError");

async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new HttpError(401, "Токен авторизации отсутствует.");
    }

    const token = header.replace("Bearer ", "").trim();
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await userRepository.findUserById(payload.sub);

    if (!user) {
      throw new HttpError(401, "Пользователь для этого токена не найден.");
    }

    const tokenVersion = typeof payload.tokenVersion === "number" ? payload.tokenVersion : 0;
    if (tokenVersion !== (user.tokenVersion ?? 0)) {
      throw new HttpError(401, "Сессия завершена. Войдите в систему снова.");
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      fullName: user.fullName,
    };
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "Недействительный или истёкший токен."));
  }
}

module.exports = authMiddleware;
