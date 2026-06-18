const rawApiUrl = String(import.meta.env.VITE_API_URL || '').trim();

export const API_BASE_URL = `${rawApiUrl.replace(/\/+$/, '')}/api`;
export const LOGIN_URL = `${import.meta.env.BASE_URL}#/login`;
