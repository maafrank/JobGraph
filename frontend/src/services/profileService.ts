import { profileApi } from './api';
import type { ApiResponse, CandidateProfile, Education, WorkExperience, UserSkillScore, ProfessionalLink } from '../types';

export const profileService = {
  // Get candidate profile
  getProfile: async (): Promise<CandidateProfile> => {
    const response = await profileApi.get<ApiResponse<CandidateProfile>>('/profiles/candidate');
    return response.data.data!;
  },

  // Update candidate profile
  updateProfile: async (data: Partial<CandidateProfile>): Promise<CandidateProfile> => {
    const response = await profileApi.put<ApiResponse<CandidateProfile>>('/profiles/candidate', data);
    return response.data.data!;
  },

  // Education endpoints
  addEducation: async (data: Omit<Education, 'id' | 'profileId'>): Promise<Education> => {
    const response = await profileApi.post<ApiResponse<Education>>('/profiles/candidate/education', data);
    return response.data.data!;
  },

  updateEducation: async (id: string, data: Partial<Education>): Promise<Education> => {
    const response = await profileApi.put<ApiResponse<Education>>(`/profiles/candidate/education/${id}`, data);
    return response.data.data!;
  },

  deleteEducation: async (id: string): Promise<void> => {
    await profileApi.delete(`/profiles/candidate/education/${id}`);
  },

  // Work experience endpoints
  addExperience: async (data: Omit<WorkExperience, 'id' | 'profileId'>): Promise<WorkExperience> => {
    const response = await profileApi.post<ApiResponse<WorkExperience>>('/profiles/candidate/experience', data);
    return response.data.data!;
  },

  updateExperience: async (id: string, data: Partial<WorkExperience>): Promise<WorkExperience> => {
    const response = await profileApi.put<ApiResponse<WorkExperience>>(`/profiles/candidate/experience/${id}`, data);
    return response.data.data!;
  },

  deleteExperience: async (id: string): Promise<void> => {
    await profileApi.delete(`/profiles/candidate/experience/${id}`);
  },

  // Skills management endpoints
  getSkills: async (): Promise<UserSkillScore[]> => {
    const response = await profileApi.get<ApiResponse<UserSkillScore[]>>('/profiles/candidate/skills');
    return response.data.data!;
  },

  addSkill: async (data: { skillId: string; score: number }): Promise<UserSkillScore> => {
    const response = await profileApi.post<ApiResponse<UserSkillScore>>('/profiles/candidate/skills', data);
    return response.data.data!;
  },

  updateSkill: async (skillId: string, score: number): Promise<UserSkillScore> => {
    const response = await profileApi.put<ApiResponse<UserSkillScore>>(`/profiles/candidate/skills/${skillId}`, { score });
    return response.data.data!;
  },

  deleteSkill: async (skillId: string): Promise<void> => {
    await profileApi.delete(`/profiles/candidate/skills/${skillId}`);
  },

  // Professional links endpoints
  addLink: async (data: { linkType: string; url: string; label?: string; displayOrder?: number }): Promise<ProfessionalLink> => {
    const response = await profileApi.post<ApiResponse<ProfessionalLink>>('/profiles/candidate/links', data);
    return response.data.data!;
  },

  updateLink: async (linkId: string, data: Partial<ProfessionalLink>): Promise<ProfessionalLink> => {
    const response = await profileApi.put<ApiResponse<ProfessionalLink>>(`/profiles/candidate/links/${linkId}`, data);
    return response.data.data!;
  },

  deleteLink: async (linkId: string): Promise<void> => {
    await profileApi.delete(`/profiles/candidate/links/${linkId}`);
  },
};
