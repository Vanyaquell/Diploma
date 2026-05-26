const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");

const env = require("../config/env");
const { ROLES, USER_STATUSES } = require("../config/constants");
const userRepository = require("../models/userRepository");
const HttpError = require("../utils/httpError");

function isSystemAdmin(user) {
  if (!user?.email || !env.adminEmail) {
    return false;
  }

  return user.email.toLowerCase() === env.adminEmail.toLowerCase();
}

function sanitizeUser(user) {
  const { passwordHash, tokenVersion, ...safeUser } = user;
  return {
    ...safeUser,
    isSystemAdmin: isSystemAdmin(user),
  };
}

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      tokenVersion: user.tokenVersion ?? 0,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

async function ensureDefaultAdmin() {
  if (!env.adminEmail || !env.adminPassword) {
    return null;
  }

  const existingAdmin = await userRepository.findUserByEmail(env.adminEmail);
  if (existingAdmin) {
    return sanitizeUser(existingAdmin);
  }

  const passwordHash = await bcrypt.hash(env.adminPassword, 10);
  const adminUser = await userRepository.createUser({
    id: crypto.randomUUID(),
    email: env.adminEmail.toLowerCase(),
    fullName: env.adminFullName,
    passwordHash,
    tokenVersion: 0,
    role: ROLES.ADMIN,
    status: USER_STATUSES.ACTIVE,
    createdAt: new Date().toISOString(),
  });

  return sanitizeUser(adminUser);
}

async function registerUser({ email, password, fullName }) {
  const normalizedEmail = email.toLowerCase();
  const existingUser = await userRepository.findUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new HttpError(409, "Пользователь с такой электронной почтой уже существует.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userRepository.createUser({
    id: crypto.randomUUID(),
    email: normalizedEmail,
    fullName,
    passwordHash,
    tokenVersion: 0,
    role: ROLES.USER,
    status: USER_STATUSES.ACTIVE,
    createdAt: new Date().toISOString(),
  });

  const accessToken = createAccessToken(user);
  return {
    user: sanitizeUser(user),
    accessToken,
  };
}

async function loginUser({ email, password }) {
  const user = await userRepository.findUserByEmail(email.toLowerCase());
  if (!user) {
    throw new HttpError(401, "Неверная электронная почта или пароль.");
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new HttpError(401, "Неверная электронная почта или пароль.");
  }

  const accessToken = createAccessToken(user);
  return {
    user: sanitizeUser(user),
    accessToken,
  };
}

async function logoutUser(userId) {
  const user = await userRepository.incrementUserTokenVersion(userId);
  if (!user) {
    throw new HttpError(404, "Пользователь не найден.");
  }
}

module.exports = {
  createAccessToken,
  ensureDefaultAdmin,
  isSystemAdmin,
  registerUser,
  loginUser,
  logoutUser,
  sanitizeUser,
};
