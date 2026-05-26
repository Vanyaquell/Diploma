import { createAction } from '@reduxjs/toolkit';

import type { AuthorizationStatusType } from '../types/authorization-status';
import type { LocationDirectory } from '../types/location-directory';
import type {
  PredictionComparisonVariant,
  PredictionHistoryRecord,
  PredictionPayload,
  PredictionResult,
} from '../types/prediction';
import type { User } from '../types/user';

const requireAuthorization = createAction<AuthorizationStatusType>('user/requireAuthorization');
const setUser = createAction<User | null>('user/setUser');
const setUsers = createAction<User[]>('admin/setUsers');
const updateAdminUserRecord = createAction<User>('admin/updateUserRecord');
const setAuthLoadingStatus = createAction<boolean>('user/setAuthLoadingStatus');
const setError = createAction<string | null>('app/setError');
const setPredictionDraft = createAction<PredictionPayload>('prediction/setPredictionDraft');
const setPredictionResult = createAction<PredictionResult | null>('prediction/setPredictionResult');
const setPredictionComparisons = createAction<PredictionComparisonVariant[]>('prediction/setPredictionComparisons');
const addPredictionComparison = createAction<PredictionComparisonVariant>('prediction/addPredictionComparison');
const removePredictionComparison = createAction<string>('prediction/removePredictionComparison');
const setPredictionHistory = createAction<PredictionHistoryRecord[]>('prediction/setPredictionHistory');
const updatePredictionHistoryRecord = createAction<PredictionHistoryRecord>('prediction/updatePredictionHistoryRecord');
const setPredictionLoadingStatus = createAction<boolean>('prediction/setPredictionLoadingStatus');
const setHistoryLoadingStatus = createAction<boolean>('prediction/setHistoryLoadingStatus');
const setPredictionLocations = createAction<LocationDirectory | null>('prediction/setPredictionLocations');
const setAdminLoadingStatus = createAction<boolean>('admin/setAdminLoadingStatus');

export {
  requireAuthorization,
  setAdminLoadingStatus,
  setAuthLoadingStatus,
  setError,
  setHistoryLoadingStatus,
  setPredictionDraft,
  setPredictionComparisons,
  setPredictionHistory,
  setPredictionLocations,
  setPredictionLoadingStatus,
  setPredictionResult,
  setUser,
  setUsers,
  addPredictionComparison,
  removePredictionComparison,
  updatePredictionHistoryRecord,
  updateAdminUserRecord,
};
