type ModelMetrics = {
  mae: number;
  rmse: number;
  mape: number;
  r2: number;
};

type ModelOverview = {
  activeCategoricalFeatures: string[];
  activeDatasetName: string | null;
  activeDatasetRows: number | null;
  activeDatasetVersionId: string | null;
  activeNumericFeatures: string[];
  allMetrics: Record<string, ModelMetrics>;
  isModelLoaded: boolean;
  isServiceHealthy: boolean;
  modelPath: string;
  modelVersion: string;
  selectedModel: string;
  selectedModelMetrics: ModelMetrics | null;
  trainedAt: string | null;
};

type DatasetPreviewRow = Record<string, string>;

type DatasetVersion = {
  id: string;
  fileName: string;
  storedFilePath: string;
  sourceType: string;
  status: string;
  isActive: boolean;
  rowsCount: number;
  columns: string[];
  preview: DatasetPreviewRow[];
  cityDistribution: Record<string, number>;
  roomDistribution: Record<string, number>;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string | null;
};

type TrainingJob = {
  id: string;
  datasetVersionId: string;
  datasetFileName: string;
  createdBy: string | null;
  status: string;
  stage: string;
  modelName: string | null;
  modelVersion: string | null;
  metrics: Record<string, ModelMetrics> | null;
  artifactsDir: string | null;
  processedDatasetPath: string | null;
  featureManifestPath: string | null;
  logOutput: string;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  appliedAt: string | null;
  updatedAt: string | null;
};

type ModelApplication = {
  id: string;
  trainingJobId: string;
  datasetVersionId: string;
  datasetFileName: string;
  modelName: string | null;
  modelVersion: string | null;
  appliedBy: string | null;
  appliedAt: string;
};

type AdminMlDashboard = {
  modelOverview: ModelOverview;
  datasetVersions: DatasetVersion[];
  availableModels: TrainingJob[];
  modelApplications: ModelApplication[];
  trainingJobs: TrainingJob[];
};

export type { AdminMlDashboard, DatasetVersion, ModelApplication, ModelMetrics, ModelOverview, TrainingJob };
