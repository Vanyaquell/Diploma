const bcrypt = require("bcryptjs");

const env = require("../config/env");
const { ROLES, USER_STATUSES } = require("../config/constants");
const userRepository = require("../models/userRepository");
const { sanitizeUser, isSystemAdmin } = require("./authService");
const HttpError = require("../utils/httpError");

async function getCurrentUser(userId) {
  const user = await userRepository.findUserById(userId);
  if (!user) {
    throw new HttpError(404, "Пользователь не найден.");
  }
  return sanitizeUser(user);
}

async function listUsers() {
  const users = await userRepository.findAllUsers();
  return users.map(sanitizeUser);
}

async function updateUserAccess(userId, updates) {
  const user = await userRepository.findUserById(userId);
  if (!user) {
    throw new HttpError(404, "Пользователь не найден.");
  }

  if (isSystemAdmin(user)) {
    throw new HttpError(
      403,
      `Роль и статус системного администратора ${env.adminEmail} изменять нельзя.`
    );
  }

  const nextRole = updates.role ?? user.role;
  const nextStatus = updates.status ?? user.status;

  if (![ROLES.USER, ROLES.ADMIN].includes(nextRole)) {
    throw new HttpError(400, "Указано недопустимое значение роли.");
  }

  if (![USER_STATUSES.ACTIVE, USER_STATUSES.BLOCKED].includes(nextStatus)) {
    throw new HttpError(400, "Указано недопустимое значение статуса.");
  }

  const updatedUser = await userRepository.updateUser(userId, {
    role: nextRole,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  });

  return sanitizeUser(updatedUser);
}

async function updateCurrentUserProfile(userId, updates) {
  const user = await userRepository.findUserById(userId);
  if (!user) {
    throw new HttpError(404, "Пользователь не найден.");
  }

  if (user.status !== USER_STATUSES.ACTIVE) {
    throw new HttpError(403, "Аккаунт заблокирован. Изменение профиля недоступно.");
  }

  const nextFullName = updates.fullName ?? user.fullName;
  const nextEmail = updates.email ? updates.email.toLowerCase() : user.email;

  if (isSystemAdmin(user) && nextEmail !== user.email) {
    throw new HttpError(403, "Системному администратору нельзя изменять электронную почту.");
  }

  if (nextEmail !== user.email) {
    const existingUser = await userRepository.findUserByEmail(nextEmail);
    if (existingUser && existingUser.id !== user.id) {
      throw new HttpError(409, "Пользователь с такой электронной почтой уже существует.");
    }
  }

  const updatedUser = await userRepository.updateUser(userId, {
    fullName: nextFullName,
    email: nextEmail,
    updatedAt: new Date().toISOString(),
  });

  return sanitizeUser(updatedUser);
}

async function updateCurrentUserPassword(userId, { currentPassword, newPassword }) {
  const user = await userRepository.findUserById(userId);
  if (!user) {
    throw new HttpError(404, "Пользователь не найден.");
  }

  if (user.status !== USER_STATUSES.ACTIVE) {
    throw new HttpError(403, "Аккаунт заблокирован. Смена пароля недоступна.");
  }

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentPasswordValid) {
    throw new HttpError(400, "Текущий пароль указан неверно.");
  }

  if (currentPassword === newPassword) {
    throw new HttpError(400, "Новый пароль должен отличаться от текущего.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await userRepository.updateUser(userId, {
    passwordHash,
    updatedAt: new Date().toISOString(),
  });
}

module.exports = {
  getCurrentUser,
  listUsers,
  updateCurrentUserPassword,
  updateCurrentUserProfile,
  updateUserAccess,
};
