const { query } = require("../database/pool");

function mapTrainingJob(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    datasetVersionId: row.dataset_version_id,
    datasetFileName: row.dataset_file_name,
    createdBy: row.created_by,
    status: row.status,
    stage: row.stage,
    modelName: row.model_name,
    modelVersion: row.model_version,
    metrics: row.metrics || null,
    artifactsDir: row.artifacts_dir,
    processedDatasetPath: row.processed_dataset_path,
    featureManifestPath: row.feature_manifest_path,
    logOutput: row.log_output || "",
    errorMessage: row.error_message,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    startedAt: row.started_at instanceof Date ? row.started_at.toISOString() : row.started_at,
    finishedAt: row.finished_at instanceof Date ? row.finished_at.toISOString() : row.finished_at,
    appliedAt: row.applied_at instanceof Date ? row.applied_at.toISOString() : row.applied_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

const BASE_SELECT = `
  SELECT
    training_jobs.id,
    training_jobs.dataset_version_id,
    dataset_versions.file_name AS dataset_file_name,
    training_jobs.created_by,
    training_jobs.status,
    training_jobs.stage,
    training_jobs.model_name,
    training_jobs.model_version,
    training_jobs.metrics,
    training_jobs.artifacts_dir,
    training_jobs.processed_dataset_path,
    training_jobs.feature_manifest_path,
    training_jobs.log_output,
    training_jobs.error_message,
    training_jobs.created_at,
    training_jobs.started_at,
    training_jobs.finished_at,
    training_jobs.applied_at,
    training_jobs.updated_at
  FROM training_jobs
  INNER JOIN dataset_versions
    ON dataset_versions.id = training_jobs.dataset_version_id
`;

async function findAllTrainingJobs() {
  const result = await query(
    `
      ${BASE_SELECT}
      ORDER BY training_jobs.created_at DESC
    `
  );

  return result.rows.map(mapTrainingJob);
}

async function findTrainingJobById(trainingJobId) {
  const result = await query(
    `
      ${BASE_SELECT}
      WHERE training_jobs.id = $1
      LIMIT 1
    `,
    [trainingJobId]
  );

  return mapTrainingJob(result.rows[0]);
}

async function findActiveTrainingJob() {
  const result = await query(
    `
      ${BASE_SELECT}
      WHERE training_jobs.status IN ('queued', 'running', 'applying')
      ORDER BY training_jobs.created_at DESC
      LIMIT 1
    `
  );

  return mapTrainingJob(result.rows[0]);
}

async function findTrainingJobsByDatasetVersionId(datasetVersionId) {
  const result = await query(
    `
      ${BASE_SELECT}
      WHERE training_jobs.dataset_version_id = $1
      ORDER BY training_jobs.created_at DESC
    `,
    [datasetVersionId]
  );

  return result.rows.map(mapTrainingJob);
}

async function createTrainingJob(payload) {
  const result = await query(
    `
      INSERT INTO training_jobs (
        id,
        dataset_version_id,
        created_by,
        status,
        stage,
        model_name,
        model_version,
        metrics,
        artifacts_dir,
        processed_dataset_path,
        feature_manifest_path,
        log_output,
        error_message,
        created_at,
        started_at,
        finished_at,
        applied_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id
    `,
    [
      payload.id,
      payload.datasetVersionId,
      payload.createdBy || null,
      payload.status,
      payload.stage,
      payload.modelName || null,
      payload.modelVersion || null,
      payload.metrics ? JSON.stringify(payload.metrics) : null,
      payload.artifactsDir || null,
      payload.processedDatasetPath || null,
      payload.featureManifestPath || null,
      payload.logOutput || "",
      payload.errorMessage || null,
      payload.createdAt,
      payload.startedAt || null,
      payload.finishedAt || null,
      payload.appliedAt || null,
      payload.updatedAt || null,
    ]
  );

  return findTrainingJobById(result.rows[0].id);
}

async function updateTrainingJob(trainingJobId, updates) {
  const columnMap = {
    datasetVersionId: "dataset_version_id",
    createdBy: "created_by",
    status: "status",
    stage: "stage",
    modelName: "model_name",
    modelVersion: "model_version",
    metrics: "metrics",
    artifactsDir: "artifacts_dir",
    processedDatasetPath: "processed_dataset_path",
    featureManifestPath: "feature_manifest_path",
    logOutput: "log_output",
    errorMessage: "error_message",
    createdAt: "created_at",
    startedAt: "started_at",
    finishedAt: "finished_at",
    appliedAt: "applied_at",
    updatedAt: "updated_at",
  };

  const entries = Object.entries(updates)
    .filter(([key, value]) => columnMap[key] && value !== undefined)
    .map(([key, value]) => [columnMap[key], key === "metrics" && value !== null ? JSON.stringify(value) : value]);

  if (entries.length === 0) {
    return findTrainingJobById(trainingJobId);
  }

  const assignments = entries.map(([column], index) => `${column} = $${index + 2}`);
  const values = [trainingJobId, ...entries.map(([, value]) => value)];
  await query(
    `
      UPDATE training_jobs
      SET ${assignments.join(", ")}
      WHERE id = $1
    `,
    values
  );

  return findTrainingJobById(trainingJobId);
}

async function markUnfinishedJobsAsFailed() {
  await query(
    `
      UPDATE training_jobs
      SET
        status = 'failed',
        stage = 'failed',
        error_message = COALESCE(error_message, 'The backend was restarted before the training job finished.'),
        finished_at = COALESCE(finished_at, NOW()),
        updated_at = NOW()
      WHERE status IN ('queued', 'running', 'applying')
    `
  );
}

async function deleteTrainingJob(trainingJobId) {
  await query(
    `
      DELETE FROM training_jobs
      WHERE id = $1
    `,
    [trainingJobId]
  );
}

module.exports = {
  createTrainingJob,
  deleteTrainingJob,
  findActiveTrainingJob,
  findAllTrainingJobs,
  findTrainingJobById,
  findTrainingJobsByDatasetVersionId,
  markUnfinishedJobsAsFailed,
  updateTrainingJob,
};
