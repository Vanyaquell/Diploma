import { configureStore } from '@reduxjs/toolkit';

import { createAPI } from '../services/api';
import { reducer } from './reduce';

const api = createAPI();

const store = configureStore({
  reducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: {
        extraArgument: api,
      },
    }),
});

export { api, store };
