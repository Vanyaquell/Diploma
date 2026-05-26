const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..", "..");
const mlRoot = path.join(projectRoot, "ml");
const mlScriptsDir = path.join(mlRoot, "scripts");
const mlArtifactsDir = path.join(mlRoot, "artifacts");
const mlProcessedDir = path.join(mlRoot, "data", "processed");
const mlInterimDir = path.join(mlRoot, "data", "interim");
const adminDatasetsDir = path.join(mlRoot, "data", "admin_datasets");
const trainingJobsRootDir = path.join(mlArtifactsDir, "jobs");

const activeCleanedDatasetPath = path.join(mlInterimDir, "cleaned_listings.csv");
const activeFeatureManifestPath = path.join(mlProcessedDir, "feature_manifest.json");
const activeModelPath = path.join(mlArtifactsDir, "best_model.joblib");
const activeMetricsPath = path.join(mlArtifactsDir, "metrics.json");
const activeTrainingSummaryPath = path.join(mlArtifactsDir, "training_summary.json");
const activeFeatureImportancePath = path.join(mlArtifactsDir, "feature_importance.csv");

function ensureAdminMlDirectories() {
  for (const directoryPath of [adminDatasetsDir, trainingJobsRootDir]) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function resolvePythonExecutable() {
  const candidates = [
    process.env.PYTHON_EXECUTABLE,
    "C:\\Python314\\python.exe",
    "python",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === "python" || fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "python";
}

module.exports = {
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
  projectRoot,
  resolvePythonExecutable,
  trainingJobsRootDir,
};
