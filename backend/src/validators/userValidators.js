const { z } = require("zod");
const {
  currentPasswordSchema,
  emailSchema,
  fullNameSchema,
  passwordSchema,
} = require("./commonValidators");

const updateCurrentUserSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    email: emailSchema.optional(),
  })
  .refine((value) => value.fullName !== undefined || value.email !== undefined, {
    message: "Укажите хотя бы одно поле для обновления.",
  });

const updateCurrentUserPasswordSchema = z.object({
  currentPassword: currentPasswordSchema,
  newPassword: passwordSchema,
});

module.exports = {
  updateCurrentUserPasswordSchema,
  updateCurrentUserSchema,
};
