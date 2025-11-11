import { skillsApi } from './api';
import type { ApiResponse, Skill, PaginatedResponse } from '../types';

export interface SkillsQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  active?: boolean;
}

export const skillsService = {
  // Get all skills with pagination and filters
  getSkills: async (params?: SkillsQueryParams): Promise<PaginatedResponse<Skill>> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.category) queryParams.append('category', params.category);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.active !== undefined) queryParams.append('active', params.active.toString());

    const response = await skillsApi.get<ApiResponse<Skill[]>>(
      `/skills?${queryParams.toString()}`
    );

    return {
      data: response.data.data!,
      pagination: response.data.pagination,
    };
  },

  // Get skill by ID
  getSkillById: async (id: string): Promise<Skill> => {
    const response = await skillsApi.get<ApiResponse<Skill>>(`/skills/${id}`);
    return response.data.data!;
  },

  // Get all skill categories
  getCategories: async (): Promise<string[]> => {
    const response = await skillsApi.get<ApiResponse<string[]>>('/skills/categories');
    return response.data.data!;
  },
};
