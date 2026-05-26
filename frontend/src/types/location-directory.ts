type LocationDirectory = {
  activeDatasetVersionId: string | null;
  cities: string[];
  districtOptions: Record<string, string[]>;
  undergroundOptions: Record<string, string[]>;
  districtToUndergroundRecommendations: Record<string, Record<string, string[]>>;
  undergroundToDistrictRecommendations: Record<string, Record<string, string[]>>;
  roomOptions: number[];
};

export type { LocationDirectory };
