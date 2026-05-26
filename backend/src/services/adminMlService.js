const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");

const datasetVersionRepository = require("../models/datasetVersionRepository");
const modelApplicationRepository = require("../models/modelApplicationRepository");
const trainingJobRepository = require("../models/trainingJobRepository");
const mlClient = require("../integrations/ml/mlClient");
const HttpError = require("../utils/httpError");
const {
  buildEditableDatasetWorkbookBuffer,
  cleanDatasetRecords,
  inspectDatasetFile,
  inspectDatasetRecords,
  loadDatasetRecords,
  saveDatasetRecordsAsCanonicalCsv,
} = require("./datasetInspector");
const {
  activeCleanedDatasetPath,
  activeFeatureImportancePath,
  activeFeatureManifestPath,
  activeMetricsPath,
  activeModelPath,
  activeTrainingSummaryPath,
  adminDatasetsDir,
  ensureAdminMlDirectories,
  mlRoot,
  mlScriptsDir,
  resolvePythonExecutable,
  trainingJobsRootDir,
} = require("./adminMlPaths");

function nowIso() {
  return new Date().toISOString();
}

let initializationPromise = null;

function buildModelVersion() {
  return `model-${nowIso().replace(/[-:TZ.]/g, "").slice(0, 14)}`;
}

function sanitizeFileName(fileName) {
  return String(fileName || "dataset.csv").replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function toEditableWorkbookFileName(fileName) {
  const parsedPath = path.parse(String(fileName || "dataset"));
  const baseName = parsedPath.name || "dataset";
  return `${baseName}.xlsx`;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(filePath, fallbackValue) {
  if (!(await pathExists(filePath))) {
    return fallbackValue;
  }

  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content);
}

async function copyFileIfExists(sourcePath, destinationPath) {
  if (!(await pathExists(sourcePath))) {
    return false;
  }

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
  return true;
}

async function removePathIfExists(targetPath) {
  if (!targetPath) {
    return;
  }

  await fs.rm(targetPath, { recursive: true, force: true }).catch(() => undefined);
}

async function assertPathExists(targetPath, description) {
  if (!(await pathExists(targetPath))) {
    throw new Error(`${description} не найден: ${targetPath}`);
  }
}

async function syncDatasetVersionSummary(datasetVersion) {
  try {
    const datasetSummary = await inspectDatasetFile(datasetVersion.storedFilePath);
    const nextFileName = toEditableWorkbookFileName(
      datasetVersion.sourceType === "system" ? "training_dataset_base.xlsx" : datasetVersion.fileName
    );

    await datasetVersionRepository.updateDatasetVersion(datasetVersion.id, {
      fileName: nextFileName,
      rowsCount: datasetSummary.rowsCount,
      columns: datasetSummary.columns,
      preview: datasetSummary.preview,
      cityDistribution: datasetSummary.cityDistribution,
      roomDistribution: datasetSummary.roomDistribution,
      updatedAt: nowIso(),
    });
  } catch {
  }
}

async function performInitialization() {
  ensureAdminMlDirectories();
  await trainingJobRepository.markUnfinishedJobsAsFailed();

  const existingDatasets = await datasetVersionRepository.findAllDatasetVersions();
  if (existingDatasets.length > 0) {
    await Promise.all(existingDatasets.map((datasetVersion) => syncDatasetVersionSummary(datasetVersion)));

    const activeDataset = existingDatasets.find((dataset) => dataset.isActive);
    if (!activeDataset) {
      await datasetVersionRepository.updateDatasetVersion(existingDatasets[0].id, {
        isActive: true,
        status: "active",
        updatedAt: nowIso(),
      });
    }
    return;
  }

  if (!(await pathExists(activeCleanedDatasetPath))) {
    return;
  }

  const datasetVersionId = crypto.randomUUID();
  const storedFilePath = path.join(adminDatasetsDir, `${datasetVersionId}_training_dataset_base.csv`);
  await fs.copyFile(activeCleanedDatasetPath, storedFilePath);

  const datasetSummary = await inspectDatasetFile(storedFilePath);
  await datasetVersionRepository.createDatasetVersion({
    id: datasetVersionId,
    fileName: "training_dataset_base.xlsx",
    storedFilePath,
    sourceType: "system",
    status: "active",
    isActive: true,
    rowsCount: datasetSummary.rowsCount,
    columns: datasetSummary.columns,
    preview: datasetSummary.preview,
    cityDistribution: datasetSummary.cityDistribution,
    roomDistribution: datasetSummary.roomDistribution,
    uploadedBy: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

async function initializeAdminMlState() {
  if (!initializationPromise) {
    initializationPromise = performInitialization().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}

async function buildModelOverview() {
  const [metrics, trainingSummary, activeDatasetVersion] = await Promise.all([
    readJsonIfExists(activeMetricsPath, {}),
    readJsonIfExists(activeTrainingSummaryPath, {}),
    datasetVersionRepository.findActiveDatasetVersion(),
  ]);

  let modelInfo = null;
  let healthInfo = null;
  try {
    [modelInfo, healthInfo] = await Promise.all([
      mlClient.getModelInfo(),
      mlClient.getHealth(),
    ]);
  } catch {
    modelInfo = null;
    healthInfo = null;
  }

  const selectedModel = modelInfo?.selected_model || trainingSummary.selected_model || "unknown";
  const selectedModelMetrics = metrics[selectedModel] || null;

  return {
    activeCategoricalFeatures: modelInfo?.active_categorical_features || trainingSummary.active_categorical_features || [],
    activeDatasetName: activeDatasetVersion?.fileName || null,
    activeDatasetRows: activeDatasetVersion?.rowsCount || null,
    activeDatasetVersionId: activeDatasetVersion?.id || null,
    activeNumericFeatures: modelInfo?.active_numeric_features || trainingSummary.active_numeric_features || [],
    allMetrics: metrics,
    isModelLoaded: Boolean(healthInfo?.model_loaded),
    isServiceHealthy: Boolean(healthInfo?.status === "ok"),
    modelPath: modelInfo?.model_path || activeModelPath,
    modelVersion: modelInfo?.model_version || trainingSummary.model_version || "1.0.0",
    selectedModel,
    selectedModelMetrics,
    trainedAt: trainingSummary.trained_at || null,
  };
}

async function getMlDashboard() {
  await initializeAdminMlState();

  const [modelOverview, datasetVersions, trainingJobs, modelApplications] = await Promise.all([
    buildModelOverview(),
    datasetVersionRepository.findAllDatasetVersions(),
    trainingJobRepository.findAllTrainingJobs(),
    modelApplicationRepository.findAllModelApplications(),
  ]);

  const availableModels = trainingJobs.filter((job) => (
    Boolean(job.modelVersion)
    && Boolean(job.artifactsDir)
    && job.stage === "completed"
    && ["ready", "applied", "applying"].includes(job.status)
  ));

  return {
    availableModels,
    datasetVersions,
    modelApplications,
    modelOverview,
    trainingJobs,
  };
}

async function createDatasetVersionFromUpload(userId, file) {
  await initializeAdminMlState();

  if (!file) {
    throw new HttpError(400, "Файл датасета не был передан.");
  }

  const datasetVersionId = crypto.randomUUID();
  const originalFileName = file.originalname || "uploaded_dataset.xlsx";
  const safeFileName = sanitizeFileName(originalFileName);
  const storedFilePath = path.join(adminDatasetsDir, `${datasetVersionId}_${path.parse(safeFileName).name}.csv`);

  try {
    const records = await loadDatasetRecords(file.path);
    const { records: cleanedRecords } = cleanDatasetRecords(records);
    if (!cleanedRecords.length) {
      throw new HttpError(400, "После автоматической очистки загруженный датасет оказался пустым.");
    }

    const datasetSummary = inspectDatasetRecords(cleanedRecords);
    await saveDatasetRecordsAsCanonicalCsv(cleanedRecords, storedFilePath);
    await fs.rm(file.path, { force: true }).catch(() => undefined);

    return datasetVersionRepository.createDatasetVersion({
      id: datasetVersionId,
      fileName: toEditableWorkbookFileName(originalFileName),
      storedFilePath,
      sourceType: "upload",
      status: "ready",
      isActive: false,
      rowsCount: datasetSummary.rowsCount,
      columns: datasetSummary.columns,
      preview: datasetSummary.preview,
      cityDistribution: datasetSummary.cityDistribution,
      roomDistribution: datasetSummary.roomDistribution,
      uploadedBy: userId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  } catch (error) {
    await fs.rm(storedFilePath, { force: true }).catch(() => undefined);
    await fs.rm(file.path, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function getDatasetVersionForDownload(datasetVersionId) {
  await initializeAdminMlState();
  const datasetVersion = await datasetVersionRepository.findDatasetVersionById(datasetVersionId);
  if (!datasetVersion) {
    throw new HttpError(404, "Версия датасета не найдена.");
  }

  return {
    fileBuffer: await buildEditableDatasetWorkbookBuffer(datasetVersion.storedFilePath),
    fileName: toEditableWorkbookFileName(datasetVersion.fileName),
  };
}

async function deleteDatasetVersion(datasetVersionId) {
  await initializeAdminMlState();

  const datasetVersion = await datasetVersionRepository.findDatasetVersionById(datasetVersionId);
  if (!datasetVersion) {
    throw new HttpError(404, "Версия датасета не найдена.");
  }

  if (datasetVersion.sourceType === "system") {
    throw new HttpError(409, "Системный датасет удалить нельзя. Он нужен как базовая версия для возврата.");
  }

  if (datasetVersion.isActive) {
    throw new HttpError(409, "Активную версию датасета нельзя удалить.");
  }

  const relatedTrainingJobs = await trainingJobRepository.findTrainingJobsByDatasetVersionId(datasetVersionId);
  const hasRunningJob = relatedTrainingJobs.some((job) => ["queued", "running", "applying"].includes(job.status));
  if (hasRunningJob) {
    throw new HttpError(409, "Нельзя удалить датасет, пока связанное переобучение ещё выполняется.");
  }

  await datasetVersionRepository.deleteDatasetVersion(datasetVersionId);

  await Promise.all([
    removePathIfExists(datasetVersion.storedFilePath),
    ...relatedTrainingJobs.map((job) => removePathIfExists(job.artifactsDir ? path.dirname(job.artifactsDir) : null)),
  ]);
}

async function startTrainingJob(userId, datasetVersionId) {
  await initializeAdminMlState();

  const datasetVersion = await datasetVersionRepository.findDatasetVersionById(datasetVersionId);
  if (!datasetVersion) {
    throw new HttpError(404, "Версия датасета не найдена.");
  }

  const activeJob = await trainingJobRepository.findActiveTrainingJob();
  if (activeJob) {
    throw new HttpError(409, "Другая задача переобучения или применения модели уже выполняется.");
  }

  const trainingJob = await trainingJobRepository.createTrainingJob({
    id: crypto.randomUUID(),
    datasetVersionId,
    createdBy: userId,
    status: "queued",
    stage: "queued",
    modelName: null,
    modelVersion: null,
    metrics: null,
    artifactsDir: null,
    processedDatasetPath: null,
    featureManifestPath: null,
    logOutput: "",
    errorMessage: null,
    createdAt: nowIso(),
    startedAt: null,
    finishedAt: null,
    appliedAt: null,
    updatedAt: nowIso(),
  });

  setImmediate(() => {
    void runTrainingJob(trainingJob.id);
  });

  return trainingJob;
}

async function deleteTrainingJob(trainingJobId) {
  await initializeAdminMlState();

  const trainingJob = await trainingJobRepository.findTrainingJobById(trainingJobId);
  if (!trainingJob) {
    throw new HttpError(404, "Задача переобучения не найдена.");
  }

  if (["queued", "running", "applying"].includes(trainingJob.status)) {
    throw new HttpError(409, "Нельзя удалить задачу переобучения, пока она выполняется.");
  }

  const activeTrainingSummary = await readJsonIfExists(activeTrainingSummaryPath, {});
  const activeModelVersion = activeTrainingSummary.model_version || null;
  if (trainingJob.modelVersion && trainingJob.modelVersion === activeModelVersion) {
    throw new HttpError(409, "Нельзя удалить запись об активной модели.");
  }

  await trainingJobRepository.deleteTrainingJob(trainingJobId);
  await removePathIfExists(trainingJob.artifactsDir ? path.dirname(trainingJob.artifactsDir) : null);
}

async function clearModelApplicationHistory() {
  await initializeAdminMlState();
  await modelApplicationRepository.deleteAllModelApplications();
}

async function runTrainingJob(trainingJobId) {
  const trainingJob = await trainingJobRepository.findTrainingJobById(trainingJobId);
  if (!trainingJob) {
    return;
  }

  const datasetVersion = await datasetVersionRepository.findDatasetVersionById(trainingJob.datasetVersionId);
  if (!datasetVersion) {
    await trainingJobRepository.updateTrainingJob(trainingJobId, {
      status: "failed",
      stage: "failed",
      errorMessage: "Версия датасета для задачи переобучения не найдена.",
      finishedAt: nowIso(),
      updatedAt: nowIso(),
    });
    return;
  }

  const jobDirectory = path.join(trainingJobsRootDir, trainingJobId);
  const cleanedTrainingDatasetPath = path.join(jobDirectory, "cleaned_training_dataset.csv");
  const processedDatasetPath = path.join(jobDirectory, "model_input.csv");
  const featureManifestPath = path.join(jobDirectory, "feature_manifest.json");
  const artifactsDir = path.join(jobDirectory, "artifacts");
  const trainingSummaryPath = path.join(artifactsDir, "training_summary.json");
  const metricsPath = path.join(artifactsDir, "metrics.json");

  await fs.mkdir(artifactsDir, { recursive: true });

  let logOutput = "";
  const appendLog = (message) => {
    logOutput += `[${new Date().toLocaleString("ru-RU")}]: ${message}\n`;
  };

  try {
    appendLog(`Запуск задачи переобучения для датасета ${datasetVersion.fileName}.`);
    await trainingJobRepository.updateTrainingJob(trainingJobId, {
      artifactsDir,
      featureManifestPath,
      processedDatasetPath,
      startedAt: nowIso(),
      stage: "validating_dataset",
      status: "running",
      updatedAt: nowIso(),
      logOutput,
      errorMessage: null,
    });

    const records = await loadDatasetRecords(datasetVersion.storedFilePath);
    const { records: cleanedRecords, report: cleaningReport } = cleanDatasetRecords(records);
    if (!cleanedRecords.length) {
      throw new Error("После автоматической очистки датасет оказался пустым.");
    }

    await saveDatasetRecordsAsCanonicalCsv(cleanedRecords, cleanedTrainingDatasetPath);
    const datasetSummary = inspectDatasetRecords(cleanedRecords);
    appendLog(
      `Автоочистка датасета завершена: осталось ${datasetSummary.rowsCount} строк, ` +
      `удалено дублей ${cleaningReport.duplicatesRemoved}, ` +
      `некорректных/пустых строк ${cleaningReport.rowsRemovedInvalidRequiredValues}, ` +
      `выбросов ${cleaningReport.rowsRemovedByNumericFilters}, ` +
      `строк с некорректным этажом ${cleaningReport.rowsRemovedInvalidFloorRelation}.`
    );
    await trainingJobRepository.updateTrainingJob(trainingJobId, {
      logOutput,
      updatedAt: nowIso(),
    });

    await trainingJobRepository.updateTrainingJob(trainingJobId, {
      stage: "preparing_features",
      updatedAt: nowIso(),
      logOutput,
    });
    appendLog("Запущена подготовка признаков.");

    const prepareOutput = await runPythonScript("prepare_features.py", [
      "--input",
      cleanedTrainingDatasetPath,
      "--output-csv",
      processedDatasetPath,
      "--manifest-json",
      featureManifestPath,
    ]);
    if (prepareOutput) {
      appendLog(prepareOutput.trim());
    }

    await trainingJobRepository.updateTrainingJob(trainingJobId, {
      stage: "training_model",
      updatedAt: nowIso(),
      logOutput,
    });
    appendLog("Запущено обучение моделей-кандидатов.");

    const trainOutput = await runPythonScript("train_model.py", [
      "--input",
      processedDatasetPath,
      "--artifacts-dir",
      artifactsDir,
    ]);
    if (trainOutput) {
      appendLog(trainOutput.trim());
    }

    const metrics = await readJsonIfExists(metricsPath, {});
    const trainingSummary = await readJsonIfExists(trainingSummaryPath, {});
    const modelVersion = buildModelVersion();
    const trainedAt = nowIso();

    const updatedSummary = {
      ...trainingSummary,
      dataset_file_name: datasetVersion.fileName,
      dataset_version_id: datasetVersion.id,
      model_version: modelVersion,
      rows_count: datasetVersion.rowsCount,
      trained_at: trainedAt,
    };
    await fs.writeFile(trainingSummaryPath, JSON.stringify(updatedSummary, null, 2), "utf-8");

    appendLog(`Обучение завершено. Лучшая модель: ${updatedSummary.selected_model || "unknown"}.`);
    await trainingJobRepository.updateTrainingJob(trainingJobId, {
      stage: "completed",
      status: "ready",
      modelName: updatedSummary.selected_model || "unknown",
      modelVersion,
      metrics,
      finishedAt: trainedAt,
      updatedAt: trainedAt,
      logOutput,
      errorMessage: null,
    });
  } catch (error) {
    appendLog(`Ошибка: ${error.message}`);
    await trainingJobRepository.updateTrainingJob(trainingJobId, {
      stage: "failed",
      status: "failed",
      errorMessage: error.message,
      finishedAt: nowIso(),
      updatedAt: nowIso(),
      logOutput,
    });
  }
}

function runPythonScript(scriptFileName, args) {
  return new Promise((resolve, reject) => {
    const pythonExecutable = resolvePythonExecutable();
    const scriptPath = path.join(mlScriptsDir, scriptFileName);
    const child = spawn(
      pythonExecutable,
      [scriptPath, ...args],
      {
        cwd: mlRoot,
        windowsHide: true,
      }
    );

    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      reject(new Error(`Не удалось запустить Python-скрипт ${scriptFileName}: ${error.message}`));
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(output.trim() || `Python-скрипт ${scriptFileName} завершился с кодом ${code}.`));
        return;
      }

      resolve(output);
    });
  });
}

async function applyTrainingJob(trainingJobId, userId) {
  await initializeAdminMlState();

  const trainingJob = await trainingJobRepository.findTrainingJobById(trainingJobId);
  if (!trainingJob) {
    throw new HttpError(404, "Задача переобучения не найдена.");
  }

  if (!["ready", "applied"].includes(trainingJob.status)) {
    throw new HttpError(409, "Применить можно только готовую к использованию модель.");
  }

  const datasetVersion = await datasetVersionRepository.findDatasetVersionById(trainingJob.datasetVersionId);
  if (!datasetVersion) {
    throw new HttpError(404, "Версия датасета, связанная с этой задачей переобучения, не найдена.");
  }

  const activeJob = await trainingJobRepository.findActiveTrainingJob();
  if (activeJob && activeJob.id !== trainingJobId) {
    throw new HttpError(409, "Сейчас уже выполняется другая задача переобучения или применения модели.");
  }

  const previousActiveDatasetVersion = await datasetVersionRepository.findActiveDatasetVersion();

  const backupDir = path.join(trainingJobsRootDir, "__active_backup");
  const activeBackupPaths = {
    cleanedDataset: path.join(backupDir, "cleaned_listings.csv"),
    featureImportance: path.join(backupDir, "feature_importance.csv"),
    featureManifest: path.join(backupDir, "feature_manifest.json"),
    metrics: path.join(backupDir, "metrics.json"),
    model: path.join(backupDir, "best_model.joblib"),
    trainingSummary: path.join(backupDir, "training_summary.json"),
  };

  await fs.rm(backupDir, { recursive: true, force: true });
  await fs.mkdir(backupDir, { recursive: true });

  const nextActiveFiles = {
    cleanedDataset: datasetVersion.storedFilePath,
    featureImportance: path.join(trainingJob.artifactsDir, "feature_importance.csv"),
    featureManifest: trainingJob.featureManifestPath,
    metrics: path.join(trainingJob.artifactsDir, "metrics.json"),
    model: path.join(trainingJob.artifactsDir, "best_model.joblib"),
    trainingSummary: path.join(trainingJob.artifactsDir, "training_summary.json"),
  };
  const previousStatus = trainingJob.status;

  async function restoreDatasetActivation() {
    await datasetVersionRepository.clearActiveDatasetVersion();

    if (previousActiveDatasetVersion) {
      await datasetVersionRepository.updateDatasetVersion(previousActiveDatasetVersion.id, {
        isActive: previousActiveDatasetVersion.isActive,
        status: previousActiveDatasetVersion.status,
        updatedAt: nowIso(),
      });
    }

    if (!previousActiveDatasetVersion || previousActiveDatasetVersion.id !== datasetVersion.id) {
      await datasetVersionRepository.updateDatasetVersion(datasetVersion.id, {
        isActive: datasetVersion.isActive,
        status: datasetVersion.status,
        updatedAt: nowIso(),
      });
    }
  }

  try {
    await assertPathExists(nextActiveFiles.cleanedDataset, "Dataset file");
    await assertPathExists(nextActiveFiles.featureManifest, "Feature manifest");
    await assertPathExists(nextActiveFiles.metrics, "Metrics file");
    await assertPathExists(nextActiveFiles.model, "Model file");
    await assertPathExists(nextActiveFiles.trainingSummary, "Training summary file");

    await trainingJobRepository.updateTrainingJob(trainingJobId, {
      status: "applying",
      stage: "reloading_model",
      updatedAt: nowIso(),
      errorMessage: null,
    });

    await Promise.all([
      copyFileIfExists(activeCleanedDatasetPath, activeBackupPaths.cleanedDataset),
      copyFileIfExists(activeFeatureImportancePath, activeBackupPaths.featureImportance),
      copyFileIfExists(activeFeatureManifestPath, activeBackupPaths.featureManifest),
      copyFileIfExists(activeMetricsPath, activeBackupPaths.metrics),
      copyFileIfExists(activeModelPath, activeBackupPaths.model),
      copyFileIfExists(activeTrainingSummaryPath, activeBackupPaths.trainingSummary),
    ]);

    await copyFileIfExists(nextActiveFiles.cleanedDataset, activeCleanedDatasetPath);
    await copyFileIfExists(nextActiveFiles.featureImportance, activeFeatureImportancePath);
    await copyFileIfExists(nextActiveFiles.featureManifest, activeFeatureManifestPath);
    await copyFileIfExists(nextActiveFiles.metrics, activeMetricsPath);
    await copyFileIfExists(nextActiveFiles.model, activeModelPath);
    await copyFileIfExists(nextActiveFiles.trainingSummary, activeTrainingSummaryPath);

    await mlClient.reloadModel();

    await datasetVersionRepository.clearActiveDatasetVersion();
    await datasetVersionRepository.updateDatasetVersion(datasetVersion.id, {
      isActive: true,
      status: "active",
      updatedAt: nowIso(),
    });

    const appliedAt = nowIso();
    const updatedTrainingJob = await trainingJobRepository.updateTrainingJob(trainingJobId, {
      status: "applied",
      stage: "completed",
      appliedAt,
      updatedAt: appliedAt,
      errorMessage: null,
    });

    await modelApplicationRepository.createModelApplication({
      id: crypto.randomUUID(),
      trainingJobId,
      appliedBy: userId || null,
      appliedAt,
    });

    return updatedTrainingJob;
  } catch (error) {
    await Promise.all([
      copyFileIfExists(activeBackupPaths.cleanedDataset, activeCleanedDatasetPath),
      copyFileIfExists(activeBackupPaths.featureImportance, activeFeatureImportancePath),
      copyFileIfExists(activeBackupPaths.featureManifest, activeFeatureManifestPath),
      copyFileIfExists(activeBackupPaths.metrics, activeMetricsPath),
      copyFileIfExists(activeBackupPaths.model, activeModelPath),
      copyFileIfExists(activeBackupPaths.trainingSummary, activeTrainingSummaryPath),
    ]);

    try {
      await mlClient.reloadModel();
    } catch {
    }

    try {
      await restoreDatasetActivation();
    } catch {
    }

    await trainingJobRepository.updateTrainingJob(trainingJobId, {
      status: previousStatus === "applied" ? "applied" : "ready",
      stage: "completed",
      updatedAt: nowIso(),
      errorMessage: `Не удалось применить новую модель: ${error.message}`,
    });
    throw new HttpError(500, `Не удалось применить новую модель: ${error.message}`);
  } finally {
    await fs.rm(backupDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

module.exports = {
  applyTrainingJob,
  clearModelApplicationHistory,
  createDatasetVersionFromUpload,
  deleteDatasetVersion,
  deleteTrainingJob,
  getDatasetVersionForDownload,
  getMlDashboard,
  initializeAdminMlState,
  startTrainingJob,
};
