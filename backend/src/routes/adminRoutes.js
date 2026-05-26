const express = require("express");

const adminController = require("../controllers/adminController");
const activeUserMiddleware = require("../middlewares/activeUserMiddleware");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const uploadDataset = require("../middlewares/uploadDataset");
const validateRequest = require("../middlewares/validateRequest");
const { startTrainingJobSchema, updateUserSchema } = require("../validators/adminValidators");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/users", authMiddleware, activeUserMiddleware, roleMiddleware("admin"), asyncHandler(adminController.listUsers));
router.get("/ml-dashboard", authMiddleware, activeUserMiddleware, roleMiddleware("admin"), asyncHandler(adminController.getMlDashboard));
router.patch(
  "/users/:userId",
  authMiddleware,
  activeUserMiddleware,
  roleMiddleware("admin"),
  validateRequest(updateUserSchema),
  asyncHandler(adminController.updateUser)
);
router.post(
  "/datasets/upload",
  authMiddleware,
  activeUserMiddleware,
  roleMiddleware("admin"),
  uploadDataset.single("dataset"),
  asyncHandler(adminController.uploadDataset)
);
router.get(
  "/datasets/:datasetVersionId/download",
  authMiddleware,
  activeUserMiddleware,
  roleMiddleware("admin"),
  asyncHandler(adminController.downloadDataset)
);
router.delete(
  "/datasets/:datasetVersionId",
  authMiddleware,
  activeUserMiddleware,
  roleMiddleware("admin"),
  asyncHandler(adminController.deleteDataset)
);
router.post(
  "/training-jobs",
  authMiddleware,
  activeUserMiddleware,
  roleMiddleware("admin"),
  validateRequest(startTrainingJobSchema),
  asyncHandler(adminController.startTrainingJob)
);
router.delete(
  "/training-jobs/:trainingJobId",
  authMiddleware,
  activeUserMiddleware,
  roleMiddleware("admin"),
  asyncHandler(adminController.deleteTrainingJob)
);
router.delete(
  "/model-applications",
  authMiddleware,
  activeUserMiddleware,
  roleMiddleware("admin"),
  asyncHandler(adminController.clearModelApplicationHistory)
);
router.post(
  "/training-jobs/:trainingJobId/apply",
  authMiddleware,
  activeUserMiddleware,
  roleMiddleware("admin"),
  asyncHandler(adminController.applyTrainingJob)
);

module.exports = router;
