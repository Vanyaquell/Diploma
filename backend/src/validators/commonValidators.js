const { z } = require("zod");

const MAX_EMAIL_LENGTH = 255;
const MAX_FULL_NAME_LENGTH = 32;
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 8;

const emailSchema = z
  .string()
  .trim()
  .max(MAX_EMAIL_LENGTH, { message: "Электронная почта не должна превышать 255 символов." })
  .email({ message: "Укажите корректный адрес электронной почты." });

const fullNameSchema = z
  .string()
  .trim()
  .min(2, { message: "Имя должно содержать минимум 2 символа." })
  .max(MAX_FULL_NAME_LENGTH, { message: "Имя не должно превышать 32 символа." })
  .refine((value) => /^[\p{L}\s'-]+$/u.test(value), {
    message: "Имя может содержать только буквы, пробелы, дефис и апостроф.",
  })
  .refine((value) => /^\p{L}.*\p{L}$/u.test(value), {
    message: "Имя должно начинаться и заканчиваться буквой.",
  })
  .refine((value) => !/\s{2,}/.test(value), {
    message: "Имя не должно содержать повторяющиеся пробелы.",
  });

const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, { message: "Пароль должен содержать минимум 8 символов." })
  .max(MAX_PASSWORD_LENGTH, { message: "Пароль не должен превышать 128 символов." })
  .refine((value) => /\p{Ll}/u.test(value), {
    message: "Пароль должен содержать хотя бы одну строчную букву.",
  })
  .refine((value) => /\p{Lu}/u.test(value), {
    message: "Пароль должен содержать хотя бы одну заглавную букву.",
  })
  .refine((value) => /\d/.test(value), {
    message: "Пароль должен содержать хотя бы одну цифру.",
  });

const currentPasswordSchema = z
  .string()
  .min(1, { message: "Введите текущий пароль." })
  .max(MAX_PASSWORD_LENGTH, { message: "Пароль не должен превышать 128 символов." });

module.exports = {
  currentPasswordSchema,
  emailSchema,
  fullNameSchema,
  passwordSchema,
};
