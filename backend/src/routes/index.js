const express = require("express");

const healthRoutes = require("./healthRoutes");
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const predictionRoutes = require("./predictionRoutes");
const adminRoutes = require("./adminRoutes");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/predictions", predictionRoutes);
router.use("/admin", adminRoutes);

module.exports = router;
