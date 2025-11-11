import { matchingApi } from './api';
import type { ApiResponse } from '../types';

export interface SkillBreakdownItem {
  skillId: string;
  skillName: string;
  required: boolean;
  candidateScore: number;
  minimumScore: number;
  weight: number;
  meetsThreshold: boolean;
}

export interface CandidateMatch {
  matchId: string;
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
  };
  employmentType: string;
  experienceLevel: string;
  company: {
    companyId: string;
    name: string;
    industry: string;
  };
  overallScore: number;
  rank: number;
  skillBreakdown: SkillBreakdownItem[];
  status: string;
  contactedAt: string | null;
  matchedAt: string;
}

export interface JobWithScore {
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
  };
  employmentType: string;
  experienceLevel: string;
  company: {
    companyId: string;
    name: string;
    industry: string;
  };
  overallScore: number;
  isFullyQualified: boolean;
  requiredSkillsMet: number;
  totalRequiredSkills: number;
  skillBreakdown: SkillBreakdownItem[];
  postedAt: string;
}

export interface CandidateMatchesResponse {
  totalMatches: number;
  matches: CandidateMatch[];
}

export interface BrowseJobsResponse {
  totalJobs: number;
  jobs: JobWithScore[];
  message?: string;
}

export interface CalculateMatchesResponse {
  jobId: string;
  totalMatches: number;
  topMatches?: any[];
}

export interface RankedCandidate {
  matchId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  overallScore: number;
  rank: number;
  status: string;
  contactedAt: string | null;
  profile: {
    headline: string | null;
    summary: string | null;
    yearsOfExperience: number | null;
    city: string | null;
    state: string | null;
    remotePreference: string | null;
  };
  skillBreakdown: SkillBreakdownItem[];
  createdAt: string;
  // Application data (if candidate has applied)
  hasApplied: boolean;
  applicationId?: string;
  appliedAt?: string;
  coverLetter?: string;
  applicationStatus?: string;
  applicationReviewedAt?: string;
  source: 'matched' | 'applied' | 'both';
}

export interface JobCandidatesResponse {
  jobId: string;
  jobTitle: string;
  totalMatches: number;
  candidates: RankedCandidate[];
}

export const matchingService = {
  // Get all job matches for the current candidate (stored matches only)
  getCandidateMatches: async (): Promise<CandidateMatchesResponse> => {
    const response = await matchingApi.get<ApiResponse<CandidateMatchesResponse>>(
      '/matching/candidate/matches'
    );
    return response.data.data!;
  },

  // Browse all jobs with calculated match scores (including partial matches)
  browseJobsWithScores: async (): Promise<BrowseJobsResponse> => {
    const response = await matchingApi.get<ApiResponse<BrowseJobsResponse>>(
      '/matching/candidate/browse-jobs'
    );
    return response.data.data!;
  },

  // Calculate matches for a job (employer only)
  calculateJobMatches: async (jobId: string): Promise<CalculateMatchesResponse> => {
    const response = await matchingApi.post<ApiResponse<CalculateMatchesResponse>>(
      `/matching/jobs/${jobId}/calculate`
    );
    return response.data.data!;
  },

  // Get ranked candidates for a job (employer only)
  getJobCandidates: async (jobId: string): Promise<JobCandidatesResponse> => {
    const response = await matchingApi.get<ApiResponse<JobCandidatesResponse>>(
      `/matching/jobs/${jobId}/candidates`
    );
    return response.data.data!;
  },

  // Update match status (employer only)
  updateMatchStatus: async (matchId: string, status: string): Promise<void> => {
    await matchingApi.put(`/matching/matches/${matchId}/status`, { status });
  },

  // Contact candidate (employer only)
  contactCandidate: async (matchId: string): Promise<void> => {
    await matchingApi.post(`/matching/matches/${matchId}/contact`);
  },

  // Get application details (employer only)
  getApplicationDetails: async (applicationId: string): Promise<any> => {
    const response = await matchingApi.get<ApiResponse<any>>(
      `/matching/applications/${applicationId}`
    );
    return response.data.data!;
  },

  // Update application status (employer only)
  updateApplicationStatus: async (applicationId: string, status: string): Promise<void> => {
    await matchingApi.put(`/matching/applications/${applicationId}/status`, { status });
  },
};
