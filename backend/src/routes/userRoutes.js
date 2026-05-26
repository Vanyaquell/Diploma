const express = require("express");

const userController = require("../controllers/userController");
const activeUserMiddleware = require("../middlewares/activeUserMiddleware");
const authMiddleware = require("../middlewares/authMiddleware");
const validateRequest = require("../middlewares/validateRequest");
const asyncHandler = require("../utils/asyncHandler");
const {
  updateCurrentUserPasswordSchema,
  updateCurrentUserSchema,
} = require("../validators/userValidators");

const router = express.Router();

router.get("/me", authMiddleware, asyncHandler(userController.getMe));
router.patch(
  "/me",
  authMiddleware,
  activeUserMiddleware,
  validateRequest(updateCurrentUserSchema),
  asyncHandler(userController.updateMe)
);
router.patch(
  "/me/password",
  authMiddleware,
  activeUserMiddleware,
  validateRequest(updateCurrentUserPasswordSchema),
  asyncHandler(userController.updatePassword)
);

module.exports = router;
