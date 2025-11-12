import { authApi } from './api';
import type { ApiResponse, AuthResponse, LoginFormData, RegisterFormData, User } from '../types';

export const authService = {
  // Register a new user
  register: async (data: RegisterFormData): Promise<AuthResponse> => {
    const response = await authApi.post<ApiResponse<AuthResponse>>('/auth/register', {
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
    });
    return response.data.data!;
  },

  // Login
  login: async (data: LoginFormData): Promise<AuthResponse> => {
    const response = await authApi.post<ApiResponse<AuthResponse>>('/auth/login', data);
    return response.data.data!;
  },

  // Get current user profile
  getCurrentUser: async (): Promise<User> => {
    const response = await authApi.get<ApiResponse<User>>('/auth/me');
    return response.data.data!;
  },

  // Logout
  logout: async (): Promise<void> => {
    await authApi.post('/auth/logout');
  },

  // Refresh token (handled automatically by interceptor, but exposed for manual use)
  refreshToken: async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
    const response = await authApi.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      '/auth/refresh',
      { refreshToken }
    );
    return response.data.data!;
  },

  // Change password
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const response = await authApi.put<ApiResponse<{ message: string }>>(
      '/auth/change-password',
      { currentPassword, newPassword }
    );
    return response.data.data!;
  },

  // Change email
  changeEmail: async (newEmail: string, password: string): Promise<{ message: string; newEmail: string }> => {
    const response = await authApi.put<ApiResponse<{ message: string; newEmail: string }>>(
      '/auth/change-email',
      { newEmail, password }
    );
    return response.data.data!;
  },

  // Delete account
  deleteAccount: async (password: string): Promise<{ message: string }> => {
    const response = await authApi.delete<ApiResponse<{ message: string }>>(
      '/auth/account',
      { data: { password } }
    );
    return response.data.data!;
  },
};
