import axios from 'axios';
import { API_BASE_URL, LOGIN_URL } from '../config/env';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      if (!window.location.hash.includes('/login')) window.location.assign(LOGIN_URL);
    }
    return Promise.reject(error);
  },
);
