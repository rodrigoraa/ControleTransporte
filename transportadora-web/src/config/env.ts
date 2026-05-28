const rawApiUrl = import.meta.env.VITE_API_URL;

if (!rawApiUrl) {
  throw new Error('VITE_API_URL nao configurada.');
}

export const API_BASE_URL = `${rawApiUrl.replace(/\/+$/, '')}/api`;
export const LOGIN_URL = `${import.meta.env.BASE_URL}#/login`;
