import { profileApi } from './api';
import type { ApiResponse, Company, CompanyFormData } from '../types';

export const companyService = {
  // Get my company (private - for authenticated employer)
  getMyCompany: async (): Promise<Company> => {
    const response = await profileApi.get<ApiResponse<Company>>('/profiles/company');
    return response.data.data!;
  },

  // Get company by ID (public)
  getCompanyById: async (companyId: string): Promise<Company> => {
    const response = await profileApi.get<ApiResponse<Company>>(`/profiles/companies/${companyId}`);
    return response.data.data!;
  },

  // Create company profile
  createCompany: async (data: CompanyFormData): Promise<Company> => {
    const response = await profileApi.post<ApiResponse<Company>>('/profiles/company', data);
    return response.data.data!;
  },

  // Update company profile
  updateCompany: async (data: Partial<CompanyFormData>): Promise<Company> => {
    const response = await profileApi.put<ApiResponse<Company>>('/profiles/company', data);
    return response.data.data!;
  },
};
