const { query } = require("../database/pool");

function mapModelApplication(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    trainingJobId: row.training_job_id,
    datasetVersionId: row.dataset_version_id,
    datasetFileName: row.dataset_file_name,
    modelName: row.model_name,
    modelVersion: row.model_version,
    appliedBy: row.applied_by,
    appliedAt: row.applied_at instanceof Date ? row.applied_at.toISOString() : row.applied_at,
  };
}

const BASE_SELECT = `
  SELECT
    model_applications.id,
    model_applications.training_job_id,
    training_jobs.dataset_version_id,
    dataset_versions.file_name AS dataset_file_name,
    training_jobs.model_name,
    training_jobs.model_version,
    model_applications.applied_by,
    model_applications.applied_at
  FROM model_applications
  INNER JOIN training_jobs
    ON training_jobs.id = model_applications.training_job_id
  INNER JOIN dataset_versions
    ON dataset_versions.id = training_jobs.dataset_version_id
`;

async function createModelApplication(payload) {
  const result = await query(
    `
      INSERT INTO model_applications (
        id,
        training_job_id,
        applied_by,
        applied_at
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [payload.id, payload.trainingJobId, payload.appliedBy || null, payload.appliedAt]
  );

  return findModelApplicationById(result.rows[0].id);
}

async function findModelApplicationById(modelApplicationId) {
  const result = await query(
    `
      ${BASE_SELECT}
      WHERE model_applications.id = $1
      LIMIT 1
    `,
    [modelApplicationId]
  );

  return mapModelApplication(result.rows[0]);
}

async function findAllModelApplications() {
  const result = await query(
    `
      ${BASE_SELECT}
      ORDER BY model_applications.applied_at DESC
    `
  );

  return result.rows.map(mapModelApplication);
}

async function deleteAllModelApplications() {
  await query(
    `
      DELETE FROM model_applications
    `
  );
}

module.exports = {
  createModelApplication,
  deleteAllModelApplications,
  findAllModelApplications,
};
