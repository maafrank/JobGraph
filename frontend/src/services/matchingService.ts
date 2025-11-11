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
};
