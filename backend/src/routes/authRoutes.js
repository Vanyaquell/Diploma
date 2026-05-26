const express = require("express");

const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const validateRequest = require("../middlewares/validateRequest");
const { registerSchema, loginSchema } = require("../validators/authValidators");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post("/register", validateRequest(registerSchema), asyncHandler(authController.register));
router.post("/login", validateRequest(loginSchema), asyncHandler(authController.login));
router.post("/logout", authMiddleware, asyncHandler(authController.logout));

module.exports = router;
