import { jobApi } from './api';
import type { ApiResponse } from '../types';

export interface JobApplication {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  jobDescription: string;
  location: {
    city: string;
    state: string;
  };
  remoteOption: boolean;
  salary: {
    min: number | null;
    max: number | null;
    currency: string;
  };
  employmentType: string;
  experienceLevel: string;
  company: {
    companyId: string;
    name: string;
    industry: string;
  };
  coverLetter?: string;
  resumeUrl?: string;
  status: 'submitted' | 'under_review' | 'interviewing' | 'rejected' | 'withdrawn' | 'accepted';
  appliedAt: string;
  reviewedAt?: string;
  updatedAt: string;
  matchScore?: number;
  matchRank?: number;
}

export interface ApplicationDetails extends JobApplication {
  userId: string;
  job: {
    title: string;
    description: string;
    requirements?: string;
    responsibilities?: string;
    location: {
      city: string;
      state: string;
      country: string;
    };
    remoteOption: boolean;
    salary: {
      min: number | null;
      max: number | null;
      currency: string;
    };
    employmentType: string;
    experienceLevel: string;
  };
  company: {
    companyId: string;
    name: string;
    industry: string;
    description?: string;
  };
  customResponses?: Record<string, any>;
  skillBreakdown?: any[];
}

export interface MyApplicationsResponse {
  totalApplications: number;
  applications: JobApplication[];
}

export interface ApplyToJobRequest {
  coverLetter?: string;
  resumeUrl?: string;
}

export const applicationService = {
  // Apply to a job
  applyToJob: async (jobId: string, data: ApplyToJobRequest): Promise<any> => {
    const response = await jobApi.post<ApiResponse<any>>(
      `/jobs/${jobId}/apply`,
      data
    );
    return response.data.data;
  },

  // Get all my applications
  getMyApplications: async (page = 1, limit = 20, status?: string): Promise<MyApplicationsResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (status) {
      params.append('status', status);
    }

    const response = await jobApi.get<ApiResponse<MyApplicationsResponse>>(
      `/jobs/applications?${params.toString()}`
    );
    return response.data.data!;
  },

  // Get specific application details
  getApplicationById: async (applicationId: string): Promise<ApplicationDetails> => {
    const response = await jobApi.get<ApiResponse<ApplicationDetails>>(
      `/jobs/applications/${applicationId}`
    );
    return response.data.data!;
  },

  // Withdraw an application
  withdrawApplication: async (applicationId: string): Promise<void> => {
    await jobApi.delete(`/jobs/applications/${applicationId}`);
  },
};
