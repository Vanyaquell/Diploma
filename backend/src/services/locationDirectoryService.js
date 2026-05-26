const datasetVersionRepository = require("../models/datasetVersionRepository");
const { loadDatasetRecords } = require("./datasetInspector");
const { initializeAdminMlState } = require("./adminMlService");

const PREFERRED_CITY_ORDER = ["Москва", "Санкт-Петербург", "Казань", "Нижний Новгород"];
const DISTRICT_MIN_COUNT = 5;
const METRO_MIN_COUNT = 5;
const MAX_DISTRICT_OPTIONS = 25;
const MAX_METRO_OPTIONS = 30;
const MAX_RECOMMENDATIONS = 3;
const MIN_RECOMMENDATION_COUNT = 2;

let cachedLocationDirectory = null;

function normalizeValue(value) {
  if (value === null || value === undefined) {
    return "unknown";
  }

  const text = String(value).trim();
  if (!text || ["nan", "none", "null"].includes(text.toLowerCase())) {
    return "unknown";
  }

  return text;
}

function sortCityValues(values) {
  const preferred = PREFERRED_CITY_ORDER.filter((city) => values.includes(city));
  const remaining = values
    .filter((city) => !preferred.includes(city))
    .sort((left, right) => left.localeCompare(right, "ru"));

  return [...preferred, ...remaining];
}

function selectMainValues(values, minCount, maxItems) {
  const counts = new Map();

  for (const rawValue of values) {
    const value = normalizeValue(rawValue);
    if (value === "unknown") {
      continue;
    }

    counts.set(value, (counts.get(value) || 0) + 1);
  }

  const sortedEntries = [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0], "ru");
    });

  let selectedEntries = sortedEntries.filter(([, count]) => count >= minCount).slice(0, maxItems);
  if (selectedEntries.length === 0) {
    selectedEntries = sortedEntries.slice(0, maxItems);
  }

  return ["unknown", ...selectedEntries.map(([value]) => value)];
}

function buildRecommendationMap(records, sourceColumn, targetColumn, allowedSourceValues, allowedTargetValues) {
  const sourceAllowed = new Set(allowedSourceValues.filter((value) => value !== "unknown"));
  const targetAllowed = new Set(allowedTargetValues.filter((value) => value !== "unknown"));
  const pairCounts = new Map();

  for (const record of records) {
    const sourceValue = normalizeValue(record[sourceColumn]);
    const targetValue = normalizeValue(record[targetColumn]);

    if (!sourceAllowed.has(sourceValue) || !targetAllowed.has(targetValue)) {
      continue;
    }

    const pairKey = `${sourceValue}|||${targetValue}`;
    pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
  }

  const groupedRecommendations = new Map();
  for (const [pairKey, count] of pairCounts.entries()) {
    const [sourceValue, targetValue] = pairKey.split("|||");
    if (!groupedRecommendations.has(sourceValue)) {
      groupedRecommendations.set(sourceValue, []);
    }

    groupedRecommendations.get(sourceValue).push({ targetValue, count });
  }

  const recommendations = {};
  for (const [sourceValue, sourcePairs] of groupedRecommendations.entries()) {
    const topTargets = sourcePairs
      .filter(({ count }) => count >= MIN_RECOMMENDATION_COUNT)
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return left.targetValue.localeCompare(right.targetValue, "ru");
      })
      .slice(0, MAX_RECOMMENDATIONS)
      .map(({ targetValue }) => targetValue);

    if (topTargets.length > 0) {
      recommendations[sourceValue] = topTargets;
    }
  }

  return recommendations;
}

function buildLocationDirectory(records) {
  const normalizedRecords = records.map((record) => ({
    city: normalizeValue(record.city),
    district: normalizeValue(record.district),
    underground: normalizeValue(record.underground),
    roomsCount: Number.parseFloat(String(record.rooms_count ?? "").replace(",", ".")),
  }));

  const allCities = sortCityValues(
    [...new Set(normalizedRecords.map((record) => record.city).filter((city) => city !== "unknown"))]
  );
  const roomOptions = [...new Set(
    normalizedRecords
      .map((record) => record.roomsCount)
      .filter((value) => Number.isFinite(value) && value >= 0 && value <= 10)
      .map((value) => Math.trunc(value))
  )].sort((left, right) => left - right);

  const districtOptions = {};
  const undergroundOptions = {};
  const districtToUndergroundRecommendations = {};
  const undergroundToDistrictRecommendations = {};

  for (const city of allCities) {
    const cityRecords = normalizedRecords.filter((record) => record.city === city);
    const cityDistrictOptions = selectMainValues(
      cityRecords.map((record) => record.district),
      DISTRICT_MIN_COUNT,
      MAX_DISTRICT_OPTIONS
    );
    const cityUndergroundOptions = selectMainValues(
      cityRecords.map((record) => record.underground),
      METRO_MIN_COUNT,
      MAX_METRO_OPTIONS
    );

    districtOptions[city] = cityDistrictOptions;
    undergroundOptions[city] = cityUndergroundOptions;
    districtToUndergroundRecommendations[city] = buildRecommendationMap(
      cityRecords,
      "district",
      "underground",
      cityDistrictOptions,
      cityUndergroundOptions
    );
    undergroundToDistrictRecommendations[city] = buildRecommendationMap(
      cityRecords,
      "underground",
      "district",
      cityUndergroundOptions,
      cityDistrictOptions
    );
  }

  return {
    cities: allCities,
    districtOptions,
    undergroundOptions,
    districtToUndergroundRecommendations,
    undergroundToDistrictRecommendations,
    roomOptions,
  };
}

async function getPredictionLocationDirectory() {
  await initializeAdminMlState();

  const activeDatasetVersion = await datasetVersionRepository.findActiveDatasetVersion();
  if (!activeDatasetVersion) {
    return {
      activeDatasetVersionId: null,
      cities: [],
      districtOptions: {},
      undergroundOptions: {},
      districtToUndergroundRecommendations: {},
      undergroundToDistrictRecommendations: {},
      roomOptions: [],
    };
  }

  const cacheKey = `${activeDatasetVersion.id}:${activeDatasetVersion.updatedAt || ""}:${activeDatasetVersion.storedFilePath}`;
  if (cachedLocationDirectory?.cacheKey === cacheKey) {
    return cachedLocationDirectory.value;
  }

  const records = await loadDatasetRecords(activeDatasetVersion.storedFilePath);
  const nextLocationDirectory = {
    ...buildLocationDirectory(records),
    activeDatasetVersionId: activeDatasetVersion.id,
  };

  cachedLocationDirectory = {
    cacheKey,
    value: nextLocationDirectory,
  };

  return nextLocationDirectory;
}

module.exports = {
  getPredictionLocationDirectory,
};
