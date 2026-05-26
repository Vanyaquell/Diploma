import { createReducer } from '@reduxjs/toolkit';

import { AuthorizationStatus } from '../const';
import { DEFAULT_PREDICTION_FORM } from '../data/default-prediction-form';
import { getToken } from '../services/token';
import type { AuthorizationStatusType } from '../types/authorization-status';
import type { LocationDirectory } from '../types/location-directory';
import type {
  PredictionComparisonVariant,
  PredictionHistoryRecord,
  PredictionPayload,
  PredictionResult,
} from '../types/prediction';
import type { User } from '../types/user';
import {
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
  updateAdminUserRecord,
  updatePredictionHistoryRecord,
} from './action';

type InitialState = {
  authorizationStatus: AuthorizationStatusType;
  user: User | null;
  users: User[];
  error: string | null;
  isAuthLoading: boolean;
  isPredictionLoading: boolean;
  isHistoryLoading: boolean;
  isAdminLoading: boolean;
  predictionDraft: PredictionPayload;
  predictionResult: PredictionResult | null;
  predictionComparisons: PredictionComparisonVariant[];
  predictionHistory: PredictionHistoryRecord[];
  predictionLocations: LocationDirectory | null;
};

const initialAuthStatus = getToken()
  ? AuthorizationStatus.Unknown
  : AuthorizationStatus.NoAuth;

const initialState: InitialState = {
  authorizationStatus: initialAuthStatus,
  user: null,
  users: [],
  error: null,
  isAuthLoading: false,
  isPredictionLoading: false,
  isHistoryLoading: false,
  isAdminLoading: false,
  predictionDraft: DEFAULT_PREDICTION_FORM,
  predictionResult: null,
  predictionComparisons: [],
  predictionHistory: [],
  predictionLocations: null,
};

const reducer = createReducer(initialState, (builder) => {
  builder
    .addCase(requireAuthorization, (state, action) => {
      state.authorizationStatus = action.payload;
    })
    .addCase(setUser, (state, action) => {
      state.user = action.payload;
    })
    .addCase(setUsers, (state, action) => {
      state.users = action.payload;
    })
    .addCase(updateAdminUserRecord, (state, action) => {
      const userIndex = state.users.findIndex((user) => user.id === action.payload.id);
      if (userIndex === -1) {
        return;
      }

      state.users[userIndex] = action.payload;

      if (state.user?.id === action.payload.id) {
        state.user = action.payload;
      }
    })
    .addCase(setAuthLoadingStatus, (state, action) => {
      state.isAuthLoading = action.payload;
    })
    .addCase(setError, (state, action) => {
      state.error = action.payload;
    })
    .addCase(setPredictionDraft, (state, action) => {
      state.predictionDraft = action.payload;
    })
    .addCase(setPredictionResult, (state, action) => {
      state.predictionResult = action.payload;
    })
    .addCase(setPredictionComparisons, (state, action) => {
      state.predictionComparisons = action.payload;
    })
    .addCase(addPredictionComparison, (state, action) => {
      const existingIndex = state.predictionComparisons.findIndex((variant) => variant.id === action.payload.id);
      if (existingIndex !== -1) {
        state.predictionComparisons[existingIndex] = action.payload;
        return;
      }

      state.predictionComparisons = [action.payload, ...state.predictionComparisons];
    })
    .addCase(removePredictionComparison, (state, action) => {
      state.predictionComparisons = state.predictionComparisons.filter((variant) => variant.id !== action.payload);
    })
    .addCase(setPredictionHistory, (state, action) => {
      state.predictionHistory = action.payload;
    })
    .addCase(setPredictionLocations, (state, action) => {
      state.predictionLocations = action.payload;
    })
    .addCase(updatePredictionHistoryRecord, (state, action) => {
      const recordIndex = state.predictionHistory.findIndex((record) => record.id === action.payload.id);
      if (recordIndex === -1) {
        return;
      }

      state.predictionHistory[recordIndex] = action.payload;
    })
    .addCase(setPredictionLoadingStatus, (state, action) => {
      state.isPredictionLoading = action.payload;
    })
    .addCase(setHistoryLoadingStatus, (state, action) => {
      state.isHistoryLoading = action.payload;
    })
    .addCase(setAdminLoadingStatus, (state, action) => {
      state.isAdminLoading = action.payload;
    });
});

export { reducer };
export type { InitialState };
