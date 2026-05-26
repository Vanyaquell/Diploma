const { z } = require("zod");
const { emailSchema, fullNameSchema, passwordSchema } = require("./commonValidators");

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, { message: "Введите пароль." })
    .max(128, { message: "Пароль не должен превышать 128 символов." }),
});

module.exports = {
  registerSchema,
  loginSchema,
};
