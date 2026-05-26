const { z } = require("zod");

const predictionCreateSchema = z
  .object({
    city: z.string().trim().min(2).max(120),
    district: z.string().trim().min(1).max(120).default("unknown"),
    underground: z.string().trim().min(1).max(120).default("unknown"),
    total_meters: z.number().positive().max(400),
    rooms_count: z.number().min(0).max(10),
    floor: z.number().int().min(1).max(100),
    floors_count: z.number().int().min(1).max(100),
    house_material_type: z.string().trim().min(1).max(120).default("unknown"),
    finish_type: z.string().trim().min(1).max(120).default("unknown"),
    object_type: z.string().trim().min(1).max(60).default("flat"),
  })
  .refine((data) => data.floor <= data.floors_count, {
    message: "Этаж квартиры не может превышать количество этажей в доме.",
    path: ["floor"],
  });

const predictionNoteUpdateSchema = z.object({
  note: z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return null;
      }

      if (typeof value !== "string") {
        return value;
      }

      const trimmedValue = value.trim();
      return trimmedValue === "" ? null : trimmedValue;
    },
    z.string().max(500).nullable()
  ),
});

module.exports = {
  predictionCreateSchema,
  predictionNoteUpdateSchema,
};
