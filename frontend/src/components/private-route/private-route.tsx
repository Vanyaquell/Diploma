import { Navigate } from 'react-router-dom';
import type { PropsWithChildren } from 'react';

import { AppRoute, AuthorizationStatus } from '../../const';
import type { AuthorizationStatusType } from '../../types/authorization-status';

type PrivateRouteProps = {
  authorizationStatus: AuthorizationStatusType;
};

function PrivateRoute({ authorizationStatus, children }: PropsWithChildren<PrivateRouteProps>) {
  return authorizationStatus === AuthorizationStatus.Auth
    ? children
    : <Navigate to={AppRoute.Login} />;
}

export { PrivateRoute };
