import { CITY_OPTIONS } from '../const';
import type { PredictionPayload } from '../types/prediction';

const DEFAULT_PREDICTION_FORM: PredictionPayload = {
  city: CITY_OPTIONS[0],
  district: 'unknown',
  underground: 'unknown',
  total_meters: 42,
  rooms_count: 1,
  floor: 7,
  floors_count: 16,
  house_material_type: 'unknown',
  finish_type: 'unknown',
  object_type: 'flat',
};

export { DEFAULT_PREDICTION_FORM };
