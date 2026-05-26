import type { State } from '../types/state';

const getAuthorizationStatus = (state: State) => state.authorizationStatus;
const getUser = (state: State) => state.user;
const getError = (state: State) => state.error;
const getPredictionResult = (state: State) => state.predictionResult;
const getPredictionHistory = (state: State) => state.predictionHistory;

export {
  getAuthorizationStatus,
  getError,
  getPredictionHistory,
  getPredictionResult,
  getUser,
};
