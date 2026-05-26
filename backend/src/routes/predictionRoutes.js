const express = require("express");

const predictionController = require("../controllers/predictionController");
const activeUserMiddleware = require("../middlewares/activeUserMiddleware");
const authMiddleware = require("../middlewares/authMiddleware");
const validateRequest = require("../middlewares/validateRequest");
const { predictionCreateSchema, predictionNoteUpdateSchema } = require("../validators/predictionValidators");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/locations", authMiddleware, activeUserMiddleware, asyncHandler(predictionController.getPredictionLocationDirectory));
router.post(
  "/",
  authMiddleware,
  activeUserMiddleware,
  validateRequest(predictionCreateSchema),
  asyncHandler(predictionController.createPrediction)
);
router.get("/history", authMiddleware, activeUserMiddleware, asyncHandler(predictionController.getPredictionHistory));
router.patch(
  "/history/:predictionId",
  authMiddleware,
  activeUserMiddleware,
  validateRequest(predictionNoteUpdateSchema),
  asyncHandler(predictionController.updatePredictionNote)
);
router.delete("/history", authMiddleware, activeUserMiddleware, asyncHandler(predictionController.clearPredictionHistory));

module.exports = router;
