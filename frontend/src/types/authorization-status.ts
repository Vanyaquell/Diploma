import { AuthorizationStatus } from '../const';

type AuthorizationStatusType = typeof AuthorizationStatus[keyof typeof AuthorizationStatus];

export type { AuthorizationStatusType };
