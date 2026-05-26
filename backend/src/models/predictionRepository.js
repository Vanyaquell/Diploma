const { query } = require("../database/pool");

function mapPrediction(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    input: typeof row.input === "string" ? JSON.parse(row.input) : row.input,
    predictedPrice: Number(row.predicted_price),
    currency: row.currency,
    modelName: row.model_name,
    modelVersion: row.model_version,
    note: row.note,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

async function createPrediction(predictionPayload) {
  const result = await query(
    `
      INSERT INTO predictions (
        id,
        user_id,
        input,
        predicted_price,
        currency,
        model_name,
        model_version,
        note,
        created_at
      )
      VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9)
      RETURNING id, user_id, input, predicted_price, currency, model_name, model_version, note, created_at
    `,
    [
      predictionPayload.id,
      predictionPayload.userId,
      JSON.stringify(predictionPayload.input),
      predictionPayload.predictedPrice,
      predictionPayload.currency,
      predictionPayload.modelName,
      predictionPayload.modelVersion,
      predictionPayload.note ?? null,
      predictionPayload.createdAt,
    ]
  );

  return mapPrediction(result.rows[0]);
}

async function findPredictionsByUserId(userId) {
  const result = await query(
    `
      SELECT id, user_id, input, predicted_price, currency, model_name, model_version, note, created_at
      FROM predictions
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  return result.rows.map(mapPrediction);
}

async function deletePredictionsByUserId(userId) {
  const result = await query(
    `
      DELETE FROM predictions
      WHERE user_id = $1
    `,
    [userId]
  );

  return result.rowCount;
}

async function updatePredictionNoteById(userId, predictionId, note) {
  const result = await query(
    `
      UPDATE predictions
      SET note = $3
      WHERE user_id = $1 AND id = $2
      RETURNING id, user_id, input, predicted_price, currency, model_name, model_version, note, created_at
    `,
    [userId, predictionId, note]
  );

  return mapPrediction(result.rows[0]);
}

module.exports = {
  createPrediction,
  deletePredictionsByUserId,
  findPredictionsByUserId,
  updatePredictionNoteById,
};
