import {
  DISTRICT_OPTIONS_DATA,
  DISTRICT_TO_UNDERGROUND_RECOMMENDATIONS_DATA,
  UNDERGROUND_OPTIONS_DATA,
  UNDERGROUND_TO_DISTRICT_RECOMMENDATIONS_DATA,
} from './data/location-options';
import type { LocationDirectory } from './types/location-directory';

const AppRoute = {
  Main: '/',
  Login: '/login',
  Register: '/register',
  History: '/history',
  Profile: '/profile',
  Admin: '/admin',
} as const;

const AuthorizationStatus = {
  Auth: 'AUTH',
  NoAuth: 'NO_AUTH',
  Unknown: 'UNKNOWN',
} as const;

const APIRoute = {
  Register: '/auth/register',
  Login: '/auth/login',
  Logout: '/auth/logout',
  Me: '/users/me',
  MePassword: '/users/me/password',
  Predictions: '/predictions',
  PredictionLocations: '/predictions/locations',
  PredictionHistory: '/predictions/history',
  AdminUsers: '/admin/users',
  AdminMlDashboard: '/admin/ml-dashboard',
  AdminDatasetsUpload: '/admin/datasets/upload',
  AdminTrainingJobs: '/admin/training-jobs',
  AdminModelApplications: '/admin/model-applications',
  Health: '/health',
} as const;

const TOKEN_KEY_NAME = 'real-estate-token';
const BACKEND_URL = 'http://localhost:3001/api';
const REQUEST_TIMEOUT = 10000;
const TIMEOUT_SHOW_ERROR = 2500;

const CITY_OPTIONS = ['Москва', 'Санкт-Петербург', 'Казань', 'Нижний Новгород'] as const;
const ROOM_OPTIONS = [
  { label: 'Студия', value: 0 },
  { label: '1 комната', value: 1 },
  { label: '2 комнаты', value: 2 },
  { label: '3 комнаты', value: 3 },
] as const;

type RecommendationOption = {
  value: string;
  label: string;
  isRecommended: boolean;
};

const DISTRICT_OPTIONS: Record<string, readonly string[]> = DISTRICT_OPTIONS_DATA;
const UNDERGROUND_OPTIONS: Record<string, readonly string[]> = UNDERGROUND_OPTIONS_DATA;
const DISTRICT_TO_UNDERGROUND_RECOMMENDATIONS: Record<string, Record<string, readonly string[]>> =
  DISTRICT_TO_UNDERGROUND_RECOMMENDATIONS_DATA;
const UNDERGROUND_TO_DISTRICT_RECOMMENDATIONS: Record<string, Record<string, readonly string[]>> =
  UNDERGROUND_TO_DISTRICT_RECOMMENDATIONS_DATA;

const HOUSE_MATERIAL_OPTIONS = [
  { label: 'Не указано', value: 'unknown' },
] as const;

const FINISH_TYPE_OPTIONS = [
  { label: 'Не указано', value: 'unknown' },
] as const;

const OBJECT_TYPE_OPTIONS = [
  { label: 'Квартира', value: 'flat' },
] as const;

function formatUnknownOption(value: string): string {
  return value === 'unknown' ? 'Не указано' : value;
}

function buildRecommendationOptions(
  values: readonly string[],
  recommendedValues: readonly string[] = []
): RecommendationOption[] {
  const hasUnknownOption = values.includes('unknown');
  const knownValues = values.filter((value) => value !== 'unknown');
  const recommendedSet = new Set(
    recommendedValues.filter((value) => value !== 'unknown' && knownValues.includes(value))
  );

  const orderedValues = [
    ...(hasUnknownOption ? ['unknown'] : []),
    ...knownValues.filter((value) => recommendedSet.has(value)),
    ...knownValues.filter((value) => !recommendedSet.has(value)),
  ];

  return orderedValues.map((value) => ({
    value,
    label: recommendedSet.has(value)
      ? `${formatUnknownOption(value)} (рекомендуется)`
      : formatUnknownOption(value),
    isRecommended: recommendedSet.has(value),
  }));
}

function getCityOptions(locationDirectory?: LocationDirectory | null): string[] {
  const dynamicCities = locationDirectory?.cities ?? [];
  return dynamicCities.length > 0 ? dynamicCities : [...CITY_OPTIONS];
}

function getRoomOptions(locationDirectory?: LocationDirectory | null): Array<{ label: string; value: number }> {
  const dynamicRoomValues = locationDirectory?.roomOptions ?? [];
  const sourceValues = dynamicRoomValues.length > 0
    ? dynamicRoomValues
    : ROOM_OPTIONS.map((option) => option.value);

  return sourceValues.map((value) => ({
    label: value === 0
      ? 'Студия'
      : value === 1
        ? '1 комната'
        : `${value} комнаты`,
    value,
  }));
}

function getDistrictSelectOptions(
  city: string,
  selectedUnderground: string,
  locationDirectory?: LocationDirectory | null
): RecommendationOption[] {
  const sourceDistrictOptions = locationDirectory?.districtOptions ?? DISTRICT_OPTIONS;
  const sourceRecommendations = locationDirectory?.undergroundToDistrictRecommendations
    ?? UNDERGROUND_TO_DISTRICT_RECOMMENDATIONS;

  const cityDistricts = sourceDistrictOptions[city] ?? ['unknown'];
  const recommendedDistricts = selectedUnderground === 'unknown'
    ? []
    : (sourceRecommendations[city]?.[selectedUnderground] ?? []);

  return buildRecommendationOptions(cityDistricts, recommendedDistricts);
}

function getUndergroundSelectOptions(
  city: string,
  selectedDistrict: string,
  locationDirectory?: LocationDirectory | null
): RecommendationOption[] {
  const sourceUndergroundOptions = locationDirectory?.undergroundOptions ?? UNDERGROUND_OPTIONS;
  const sourceRecommendations = locationDirectory?.districtToUndergroundRecommendations
    ?? DISTRICT_TO_UNDERGROUND_RECOMMENDATIONS;

  const cityUnderground = sourceUndergroundOptions[city] ?? ['unknown'];
  const recommendedUnderground = selectedDistrict === 'unknown'
    ? []
    : (sourceRecommendations[city]?.[selectedDistrict] ?? []);

  return buildRecommendationOptions(cityUnderground, recommendedUnderground);
}

export {
  APIRoute,
  AppRoute,
  AuthorizationStatus,
  BACKEND_URL,
  CITY_OPTIONS,
  DISTRICT_OPTIONS,
  FINISH_TYPE_OPTIONS,
  HOUSE_MATERIAL_OPTIONS,
  OBJECT_TYPE_OPTIONS,
  REQUEST_TIMEOUT,
  ROOM_OPTIONS,
  TIMEOUT_SHOW_ERROR,
  TOKEN_KEY_NAME,
  UNDERGROUND_OPTIONS,
  getCityOptions,
  getDistrictSelectOptions,
  getRoomOptions,
  getUndergroundSelectOptions,
  formatUnknownOption,
};
