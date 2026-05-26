type PredictionPayload = {
  city: string;
  district: string;
  underground: string;
  total_meters: number;
  rooms_count: number;
  floor: number;
  floors_count: number;
  house_material_type: string;
  finish_type: string;
  object_type: string;
};

type PredictionResult = {
  predictionId: string;
  input: PredictionPayload;
  predictedPrice: number;
  currency: string;
  modelName: string;
  modelVersion: string;
  pricePerSquareMeter: number;
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  confidenceMarginPercent: number | null;
  createdAt: string;
};

type PredictionComparisonVariant = {
  id: string;
  input: PredictionPayload;
  predictedPrice: number;
  currency: string;
  modelName: string;
  modelVersion: string;
  pricePerSquareMeter: number;
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  confidenceMarginPercent: number | null;
  createdAt: string;
};

type PredictionHistoryRecord = {
  id: string;
  userId: string;
  input: PredictionPayload;
  predictedPrice: number;
  currency: string;
  modelName: string;
  modelVersion: string;
  note: string | null;
  createdAt: string;
};

type PredictionNoteUpdatePayload = {
  predictionId: string;
  note: string;
};

export type {
  PredictionComparisonVariant,
  PredictionHistoryRecord,
  PredictionNoteUpdatePayload,
  PredictionPayload,
  PredictionResult,
};
