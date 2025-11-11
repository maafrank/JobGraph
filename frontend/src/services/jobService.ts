import { jobApi } from './api';
import type { ApiResponse, Job, JobSkill, JobFormData, RemoteOption } from '../types';

export interface JobsQueryParams {
  page?: number;
  limit?: number;
  city?: string;
  state?: string;
  remote?: boolean;
  experience_level?: string;
  search?: string;
  status?: string;
}

export interface CreateJobData {
  companyId: string;
  title: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  city?: string;
  state?: string;
  country?: string;
  remoteOption: RemoteOption;
  employmentType: string;
  experienceLevel: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string;
  status?: string; // 'draft' or 'active'
}

export interface JobSkillData {
  skillId: string;
  weight: number; // 0-100
  minimumScore: number; // 0-100
  required: boolean;
}

export const jobService = {
  // Get all jobs with pagination and filters
  getJobs: async (params?: JobsQueryParams): Promise<{ jobs: Job[]; pagination?: any }> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.city) queryParams.append('city', params.city);
    if (params?.state) queryParams.append('state', params.state);
    if (params?.remote !== undefined) queryParams.append('remote', params.remote.toString());
    if (params?.experience_level) queryParams.append('experience_level', params.experience_level);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);

    const response = await jobApi.get<ApiResponse<Job[]>>(
      `/jobs?${queryParams.toString()}`
    );

    return {
      jobs: response.data.data!,
      pagination: response.data.pagination,
    };
  },

  // Get my jobs (employer's jobs)
  getMyJobs: async (params?: JobsQueryParams): Promise<{ jobs: Job[]; pagination?: any }> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);

    const response = await jobApi.get<ApiResponse<Job[]>>(
      `/jobs/my-jobs?${queryParams.toString()}`
    );

    return {
      jobs: response.data.data!,
      pagination: response.data.pagination,
    };
  },

  // Get job by ID
  getJobById: async (id: string): Promise<Job> => {
    const response = await jobApi.get<ApiResponse<Job>>(`/jobs/${id}`);
    return response.data.data!;
  },

  // Create new job
  createJob: async (data: CreateJobData): Promise<Job> => {
    const response = await jobApi.post<ApiResponse<Job>>('/jobs', data);
    return response.data.data!;
  },

  // Update job
  updateJob: async (id: string, data: Partial<CreateJobData>): Promise<Job> => {
    const response = await jobApi.put<ApiResponse<Job>>(`/jobs/${id}`, data);
    return response.data.data!;
  },

  // Delete/close job
  deleteJob: async (id: string): Promise<void> => {
    await jobApi.delete(`/jobs/${id}`);
  },

  // Get job skills
  getJobSkills: async (jobId: string): Promise<JobSkill[]> => {
    const response = await jobApi.get<ApiResponse<JobSkill[]>>(`/jobs/${jobId}/skills`);
    return response.data.data!;
  },

  // Add skill to job
  addJobSkill: async (jobId: string, data: JobSkillData): Promise<JobSkill> => {
    const response = await jobApi.post<ApiResponse<JobSkill>>(`/jobs/${jobId}/skills`, data);
    return response.data.data!;
  },

  // Update job skill
  updateJobSkill: async (jobId: string, skillId: string, data: Partial<JobSkillData>): Promise<JobSkill> => {
    const response = await jobApi.put<ApiResponse<JobSkill>>(`/jobs/${jobId}/skills/${skillId}`, data);
    return response.data.data!;
  },

  // Remove skill from job
  removeJobSkill: async (jobId: string, skillId: string): Promise<void> => {
    await jobApi.delete(`/jobs/${jobId}/skills/${skillId}`);
  },
};
