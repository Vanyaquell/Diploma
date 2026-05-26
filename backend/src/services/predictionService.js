const crypto = require("node:crypto");

const predictionRepository = require("../models/predictionRepository");
const mlClient = require("../integrations/ml/mlClient");
const HttpError = require("../utils/httpError");

async function createPrediction(userId, payload) {
  const mlResponse = await mlClient.predict(payload);
  const predictionRecord = await predictionRepository.createPrediction({
    id: crypto.randomUUID(),
    userId,
    input: payload,
    predictedPrice: mlResponse.predicted_price,
    currency: "RUB",
    modelName: mlResponse.model_name,
    modelVersion: mlResponse.model_version,
    note: null,
    createdAt: new Date().toISOString(),
  });

  return {
    ...predictionRecord,
    pricePerSquareMeter: Number(mlResponse.price_per_square_meter),
    estimatedPriceMin: Number(mlResponse.estimated_price_min),
    estimatedPriceMax: Number(mlResponse.estimated_price_max),
    confidenceMarginPercent: mlResponse.confidence_margin_percent === null
      ? null
      : Number(mlResponse.confidence_margin_percent),
  };
}

async function getPredictionHistory(userId) {
  return predictionRepository.findPredictionsByUserId(userId);
}

async function clearPredictionHistory(userId) {
  const deletedCount = await predictionRepository.deletePredictionsByUserId(userId);
  return { deletedCount };
}

async function updatePredictionNote(userId, predictionId, note) {
  const updatedPrediction = await predictionRepository.updatePredictionNoteById(userId, predictionId, note);

  if (!updatedPrediction) {
    throw new HttpError(404, "Запись в истории прогнозов не найдена.");
  }

  return updatedPrediction;
}

module.exports = {
  clearPredictionHistory,
  createPrediction,
  getPredictionHistory,
  updatePredictionNote,
};
