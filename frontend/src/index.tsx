import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';

import { App } from './components/app/app';
import { store } from './store';
import { checkAuthAction } from './store/api-action';
import './styles.css';

store.dispatch(checkAuthAction());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
