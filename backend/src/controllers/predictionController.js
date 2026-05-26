const predictionService = require("../services/predictionService");
const locationDirectoryService = require("../services/locationDirectoryService");

async function createPrediction(req, res) {
  const prediction = await predictionService.createPrediction(req.user.id, req.body);
  res.status(201).json({
    predictionId: prediction.id,
    input: prediction.input,
    predictedPrice: prediction.predictedPrice,
    currency: prediction.currency,
    modelName: prediction.modelName,
    modelVersion: prediction.modelVersion,
    pricePerSquareMeter: prediction.pricePerSquareMeter,
    estimatedPriceMin: prediction.estimatedPriceMin,
    estimatedPriceMax: prediction.estimatedPriceMax,
    confidenceMarginPercent: prediction.confidenceMarginPercent,
    createdAt: prediction.createdAt,
  });
}

async function getPredictionHistory(req, res) {
  const predictions = await predictionService.getPredictionHistory(req.user.id);
  res.json(predictions);
}

async function getPredictionLocationDirectory(req, res) {
  const locationDirectory = await locationDirectoryService.getPredictionLocationDirectory();
  res.json(locationDirectory);
}

async function clearPredictionHistory(req, res) {
  const result = await predictionService.clearPredictionHistory(req.user.id);
  res.json({
    message: "Prediction history cleared.",
    deletedCount: result.deletedCount,
  });
}

async function updatePredictionNote(req, res) {
  const prediction = await predictionService.updatePredictionNote(
    req.user.id,
    req.params.predictionId,
    req.body.note ?? null
  );
  res.json(prediction);
}

module.exports = {
  clearPredictionHistory,
  createPrediction,
  getPredictionHistory,
  getPredictionLocationDirectory,
  updatePredictionNote,
};
