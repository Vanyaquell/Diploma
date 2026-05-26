const express = require("express");
const cors = require("cors");

const env = require("./config/env");
const apiRoutes = require("./routes");
const { notFoundHandler, errorHandler } = require("./middlewares/errorHandler");

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes("*") || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin is not allowed: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    service: "real-estate-node-backend",
    status: "ok",
  });
});

app.use("/api", apiRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
