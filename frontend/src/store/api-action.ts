import { createAsyncThunk } from '@reduxjs/toolkit';
import type { AxiosInstance } from 'axios';

import { APIRoute, AuthorizationStatus, TIMEOUT_SHOW_ERROR } from '../const';
import { DEFAULT_PREDICTION_FORM } from '../data/default-prediction-form';
import { dropToken, saveToken } from '../services/token';
import type { LocationDirectory } from '../types/location-directory';
import type {
  PredictionHistoryRecord,
  PredictionNoteUpdatePayload,
  PredictionPayload,
  PredictionResult,
} from '../types/prediction';
import type { AppDispatch, State } from '../types/state';
import type { AuthData, AuthResponse, RegisterData, UpdateUserAccessPayload, User } from '../types/user';
import {
  setPredictionComparisons,
  requireAuthorization,
  setAdminLoadingStatus,
  setAuthLoadingStatus,
  setError,
  setHistoryLoadingStatus,
  setPredictionDraft,
  setPredictionHistory,
  setPredictionLocations,
  setPredictionLoadingStatus,
  setPredictionResult,
  setUser,
  setUsers,
  updateAdminUserRecord,
  updatePredictionHistoryRecord,
} from './action';
import { store } from './index';

type ThunkConfig = {
  dispatch: AppDispatch;
  state: State;
  extra: AxiosInstance;
};

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const maybeResponse = error as { response?: { data?: { message?: string } } };
    return maybeResponse.response?.data?.message ?? 'Запрос не выполнен.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Запрос не выполнен.';
}

const checkAuthAction = createAsyncThunk<void, undefined, ThunkConfig>(
  'user/checkAuth',
  async (_arg, { dispatch, extra: api }) => {
    try {
      dispatch(setAuthLoadingStatus(true));
      const { data } = await api.get<User>(APIRoute.Me);
      dispatch(setUser(data));
      dispatch(requireAuthorization(AuthorizationStatus.Auth));
    } catch {
      dropToken();
      dispatch(setUser(null));
      dispatch(requireAuthorization(AuthorizationStatus.NoAuth));
    } finally {
      dispatch(setAuthLoadingStatus(false));
    }
  },
);

const registerAction = createAsyncThunk<void, RegisterData, ThunkConfig>(
  'user/register',
  async (registerData, { dispatch, extra: api, rejectWithValue }) => {
    try {
      dispatch(setAuthLoadingStatus(true));
      const { data } = await api.post<AuthResponse>(APIRoute.Register, registerData);
      saveToken(data.accessToken);
      dispatch(setUser(data.user));
      dispatch(requireAuthorization(AuthorizationStatus.Auth));
    } catch (error) {
      dispatch(setError(extractErrorMessage(error)));
      dispatch(clearErrorAction());
      return rejectWithValue('Ошибка регистрации');
    } finally {
      dispatch(setAuthLoadingStatus(false));
    }
  },
);

const loginAction = createAsyncThunk<void, AuthData, ThunkConfig>(
  'user/login',
  async (authData, { dispatch, extra: api, rejectWithValue }) => {
    try {
      dispatch(setAuthLoadingStatus(true));
      const { data } = await api.post<AuthResponse>(APIRoute.Login, authData);
      saveToken(data.accessToken);
      dispatch(setUser(data.user));
      dispatch(requireAuthorization(AuthorizationStatus.Auth));
    } catch (error) {
      dropToken();
      dispatch(setUser(null));
      dispatch(requireAuthorization(AuthorizationStatus.NoAuth));
      dispatch(setError(extractErrorMessage(error)));
      dispatch(clearErrorAction());
      return rejectWithValue('Ошибка входа');
    } finally {
      dispatch(setAuthLoadingStatus(false));
    }
  },
);

const logoutAction = createAsyncThunk<void, undefined, ThunkConfig>(
  'user/logout',
  async (_arg, { dispatch, extra: api }) => {
    try {
      await api.post(APIRoute.Logout);
    } finally {
      dropToken();
      dispatch(setUser(null));
      dispatch(setPredictionDraft(DEFAULT_PREDICTION_FORM));
      dispatch(setPredictionComparisons([]));
      dispatch(setPredictionHistory([]));
      dispatch(setPredictionLocations(null));
      dispatch(setPredictionResult(null));
      dispatch(requireAuthorization(AuthorizationStatus.NoAuth));
    }
  },
);

const fetchPredictionLocationsAction = createAsyncThunk<void, undefined, ThunkConfig>(
  'prediction/fetchLocations',
  async (_arg, { dispatch, extra: api }) => {
    try {
      const { data } = await api.get<LocationDirectory>(APIRoute.PredictionLocations);
      dispatch(setPredictionLocations(data));
    } catch {
      dispatch(setPredictionLocations(null));
    }
  },
);

const createPredictionAction = createAsyncThunk<void, PredictionPayload, ThunkConfig>(
  'prediction/create',
  async (payload, { dispatch, extra: api, rejectWithValue }) => {
    try {
      dispatch(setPredictionLoadingStatus(true));
      const { data } = await api.post<PredictionResult>(APIRoute.Predictions, payload);
      dispatch(setPredictionResult(data));
      dispatch(fetchPredictionHistoryAction());
    } catch (error) {
      dispatch(setError(extractErrorMessage(error)));
      dispatch(clearErrorAction());
      return rejectWithValue('Ошибка расчёта прогноза');
    } finally {
      dispatch(setPredictionLoadingStatus(false));
    }
  },
);

const fetchPredictionHistoryAction = createAsyncThunk<void, undefined, ThunkConfig>(
  'prediction/fetchHistory',
  async (_arg, { dispatch, extra: api }) => {
    try {
      dispatch(setHistoryLoadingStatus(true));
      const { data } = await api.get<PredictionHistoryRecord[]>(APIRoute.PredictionHistory);
      dispatch(setPredictionHistory(data));
    } catch (error) {
      dispatch(setError(extractErrorMessage(error)));
      dispatch(clearErrorAction());
    } finally {
      dispatch(setHistoryLoadingStatus(false));
    }
  },
);

const clearPredictionHistoryAction = createAsyncThunk<void, undefined, ThunkConfig>(
  'prediction/clearHistory',
  async (_arg, { dispatch, extra: api }) => {
    try {
      dispatch(setHistoryLoadingStatus(true));
      await api.delete(APIRoute.PredictionHistory);
      dispatch(setPredictionHistory([]));
    } catch (error) {
      dispatch(setError(extractErrorMessage(error)));
      dispatch(clearErrorAction());
    } finally {
      dispatch(setHistoryLoadingStatus(false));
    }
  },
);

const updatePredictionNoteAction = createAsyncThunk<PredictionHistoryRecord, PredictionNoteUpdatePayload, ThunkConfig>(
  'prediction/updateNote',
  async ({ predictionId, note }, { dispatch, extra: api, rejectWithValue }) => {
    try {
      dispatch(setHistoryLoadingStatus(true));
      const { data } = await api.patch<PredictionHistoryRecord>(
        `${APIRoute.PredictionHistory}/${predictionId}`,
        { note }
      );
      dispatch(updatePredictionHistoryRecord(data));
      return data;
    } catch (error) {
      dispatch(setError(extractErrorMessage(error)));
      dispatch(clearErrorAction());
      return rejectWithValue('Ошибка обновления заметки');
    } finally {
      dispatch(setHistoryLoadingStatus(false));
    }
  },
);

const fetchAdminUsersAction = createAsyncThunk<void, undefined, ThunkConfig>(
  'admin/fetchUsers',
  async (_arg, { dispatch, extra: api }) => {
    try {
      dispatch(setAdminLoadingStatus(true));
      const { data } = await api.get<User[]>(APIRoute.AdminUsers);
      dispatch(setUsers(data));
    } catch (error) {
      dispatch(setError(extractErrorMessage(error)));
      dispatch(clearErrorAction());
    } finally {
      dispatch(setAdminLoadingStatus(false));
    }
  },
);

const updateAdminUserAction = createAsyncThunk<User, UpdateUserAccessPayload, ThunkConfig>(
  'admin/updateUser',
  async ({ userId, ...updates }, { dispatch, extra: api, rejectWithValue }) => {
    try {
      dispatch(setAdminLoadingStatus(true));
      const { data } = await api.patch<User>(`${APIRoute.AdminUsers}/${userId}`, updates);
      dispatch(updateAdminUserRecord(data));
      return data;
    } catch (error) {
      dispatch(setError(extractErrorMessage(error)));
      dispatch(clearErrorAction());
      return rejectWithValue('Ошибка обновления пользователя');
    } finally {
      dispatch(setAdminLoadingStatus(false));
    }
  },
);

const clearErrorAction = createAsyncThunk(
  'app/clearError',
  () => {
    setTimeout(() => store.dispatch(setError(null)), TIMEOUT_SHOW_ERROR);
  },
);

export {
  checkAuthAction,
  clearErrorAction,
  clearPredictionHistoryAction,
  createPredictionAction,
  fetchPredictionLocationsAction,
  fetchAdminUsersAction,
  fetchPredictionHistoryAction,
  loginAction,
  logoutAction,
  registerAction,
  updateAdminUserAction,
  updatePredictionNoteAction,
};
