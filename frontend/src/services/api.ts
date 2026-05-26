import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

import { BACKEND_URL, REQUEST_TIMEOUT } from '../const';
import { getToken } from './token';

const createAPI = (): AxiosInstance => {
  const api = axios.create({
    baseURL: BACKEND_URL,
    timeout: REQUEST_TIMEOUT,
  });

  api.interceptors.request.use((config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = getToken();

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });

  return api;
};

export { createAPI };
