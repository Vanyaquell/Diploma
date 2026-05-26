const { query } = require("../database/pool");

function mapDatasetVersion(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    fileName: row.file_name,
    storedFilePath: row.stored_file_path,
    sourceType: row.source_type,
    status: row.status,
    isActive: row.is_active,
    rowsCount: Number(row.rows_count),
    columns: Array.isArray(row.columns_json) ? row.columns_json : [],
    preview: Array.isArray(row.preview_json) ? row.preview_json : [],
    cityDistribution: row.city_distribution || {},
    roomDistribution: row.room_distribution || {},
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

async function findAllDatasetVersions() {
  const result = await query(
    `
      SELECT
        id,
        file_name,
        stored_file_path,
        source_type,
        status,
        is_active,
        rows_count,
        columns_json,
        preview_json,
        city_distribution,
        room_distribution,
        uploaded_by,
        created_at,
        updated_at
      FROM dataset_versions
      ORDER BY is_active DESC, created_at DESC
    `
  );

  return result.rows.map(mapDatasetVersion);
}

async function findDatasetVersionById(datasetVersionId) {
  const result = await query(
    `
      SELECT
        id,
        file_name,
        stored_file_path,
        source_type,
        status,
        is_active,
        rows_count,
        columns_json,
        preview_json,
        city_distribution,
        room_distribution,
        uploaded_by,
        created_at,
        updated_at
      FROM dataset_versions
      WHERE id = $1
      LIMIT 1
    `,
    [datasetVersionId]
  );

  return mapDatasetVersion(result.rows[0]);
}

async function findActiveDatasetVersion() {
  const result = await query(
    `
      SELECT
        id,
        file_name,
        stored_file_path,
        source_type,
        status,
        is_active,
        rows_count,
        columns_json,
        preview_json,
        city_distribution,
        room_distribution,
        uploaded_by,
        created_at,
        updated_at
      FROM dataset_versions
      WHERE is_active = TRUE
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `
  );

  return mapDatasetVersion(result.rows[0]);
}

async function createDatasetVersion(payload) {
  const result = await query(
    `
      INSERT INTO dataset_versions (
        id,
        file_name,
        stored_file_path,
        source_type,
        status,
        is_active,
        rows_count,
        columns_json,
        preview_json,
        city_distribution,
        room_distribution,
        uploaded_by,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14)
      RETURNING
        id,
        file_name,
        stored_file_path,
        source_type,
        status,
        is_active,
        rows_count,
        columns_json,
        preview_json,
        city_distribution,
        room_distribution,
        uploaded_by,
        created_at,
        updated_at
    `,
    [
      payload.id,
      payload.fileName,
      payload.storedFilePath,
      payload.sourceType,
      payload.status,
      payload.isActive,
      payload.rowsCount,
      JSON.stringify(payload.columns || []),
      JSON.stringify(payload.preview || []),
      JSON.stringify(payload.cityDistribution || {}),
      JSON.stringify(payload.roomDistribution || {}),
      payload.uploadedBy || null,
      payload.createdAt,
      payload.updatedAt || null,
    ]
  );

  return mapDatasetVersion(result.rows[0]);
}

async function updateDatasetVersion(datasetVersionId, updates) {
  const columnMap = {
    fileName: "file_name",
    storedFilePath: "stored_file_path",
    sourceType: "source_type",
    status: "status",
    isActive: "is_active",
    rowsCount: "rows_count",
    columns: "columns_json",
    preview: "preview_json",
    cityDistribution: "city_distribution",
    roomDistribution: "room_distribution",
    uploadedBy: "uploaded_by",
    createdAt: "created_at",
    updatedAt: "updated_at",
  };

  const jsonFields = new Set(["columns", "preview", "cityDistribution", "roomDistribution"]);
  const entries = Object.entries(updates)
    .filter(([key, value]) => columnMap[key] && value !== undefined)
    .map(([key, value]) => {
      const databaseValue = jsonFields.has(key) ? JSON.stringify(value || (key === "columns" || key === "preview" ? [] : {})) : value;
      return [columnMap[key], databaseValue];
    });

  if (entries.length === 0) {
    return findDatasetVersionById(datasetVersionId);
  }

  const assignments = entries.map(([column], index) => `${column} = $${index + 2}`);
  const values = [datasetVersionId, ...entries.map(([, value]) => value)];
  const result = await query(
    `
      UPDATE dataset_versions
      SET ${assignments.join(", ")}
      WHERE id = $1
      RETURNING
        id,
        file_name,
        stored_file_path,
        source_type,
        status,
        is_active,
        rows_count,
        columns_json,
        preview_json,
        city_distribution,
        room_distribution,
        uploaded_by,
        created_at,
        updated_at
    `,
    values
  );

  return mapDatasetVersion(result.rows[0]);
}

async function clearActiveDatasetVersion() {
  await query(
    `
      UPDATE dataset_versions
      SET is_active = FALSE, status = 'ready', updated_at = NOW()
      WHERE is_active = TRUE
    `
  );
}

async function deleteDatasetVersion(datasetVersionId) {
  await query(
    `
      DELETE FROM dataset_versions
      WHERE id = $1
    `,
    [datasetVersionId]
  );
}

module.exports = {
  clearActiveDatasetVersion,
  createDatasetVersion,
  deleteDatasetVersion,
  findActiveDatasetVersion,
  findAllDatasetVersions,
  findDatasetVersionById,
  updateDatasetVersion,
};
