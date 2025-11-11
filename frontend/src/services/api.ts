import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '../types';

// API Base URLs - different services run on different ports
const API_BASE_URLS = {
  auth: 'http://localhost:3000/api/v1',
  profile: 'http://localhost:3001/api/v1',
  job: 'http://localhost:3002/api/v1',
  skill: 'http://localhost:3003/api/v1',
  matching: 'http://localhost:3004/api/v1',
};

// Token management
export const setTokens = (access: string, refresh: string) => {
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
};

export const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
};

export const getAccessToken = () => localStorage.getItem('accessToken');
export const getRefreshToken = () => localStorage.getItem('refreshToken');

// Create axios instance for each service
const createApiClient = (baseURL: string): AxiosInstance => {
  const instance = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor to add auth token
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = getAccessToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor to handle token refresh
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      const currentRefreshToken = getRefreshToken();

      // If 401 and we haven't tried to refresh yet
      if (error.response?.status === 401 && !originalRequest._retry && currentRefreshToken) {
        originalRequest._retry = true;

        try {
          // Try to refresh the token using auth service
          const response = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
            `${API_BASE_URLS.auth}/auth/refresh`,
            { refreshToken: currentRefreshToken }
          );

          if (response.data.success && response.data.data) {
            const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;
            setTokens(newAccessToken, newRefreshToken);

            // Retry the original request with new token
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            }
            return instance(originalRequest);
          }
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          clearTokens();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

// Create API clients for each service
export const authApi = createApiClient(API_BASE_URLS.auth);
export const profileApi = createApiClient(API_BASE_URLS.profile);
export const jobApi = createApiClient(API_BASE_URLS.job);
export const skillApi = createApiClient(API_BASE_URLS.skill);
export const matchingApi = createApiClient(API_BASE_URLS.matching);

// Helper function to handle API errors
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiResponse;
    if (apiError?.error) {
      return apiError.error.message;
    }
    return error.message || 'An unexpected error occurred';
  }
  return 'An unexpected error occurred';
};
