const { z } = require("zod");

const updateUserSchema = z
  .object({
    role: z.enum(["user", "admin"]).optional(),
    status: z.enum(["active", "blocked"]).optional(),
  })
  .refine((value) => value.role || value.status, {
    message: "Provide at least one field to update.",
  });

const startTrainingJobSchema = z.object({
  datasetVersionId: z.string().uuid(),
});

module.exports = {
  startTrainingJobSchema,
  updateUserSchema,
};
