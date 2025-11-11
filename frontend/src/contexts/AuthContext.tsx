import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/authService';
import { setTokens, clearTokens } from '../services/api';
import type { User, LoginFormData, RegisterFormData } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (data: LoginFormData) => Promise<void>;
  register: (data: RegisterFormData) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (data: LoginFormData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.login(data);
          setTokens(response.accessToken, response.refreshToken);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error?.message || 'Login failed';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      register: async (data: RegisterFormData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.register(data);
          setTokens(response.accessToken, response.refreshToken);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error?.message || 'Registration failed';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await authService.logout();
        } catch (error) {
          // Ignore logout errors
        } finally {
          clearTokens();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null
          });
        }
      },

      loadUser: async () => {
        set({ isLoading: true, error: null });
        try {
          const user = await authService.getCurrentUser();
          set({
            user,
            isAuthenticated: true,
            isLoading: false
          });
        } catch (error) {
          clearTokens();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false
          });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
);
