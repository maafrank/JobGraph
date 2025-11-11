import { matchingApi } from './api';
import type { ApiResponse, JobMatch } from '../types';

export const matchingService = {
  // Get all job matches for the current candidate
  getCandidateMatches: async (): Promise<JobMatch[]> => {
    const response = await matchingApi.get<ApiResponse<JobMatch[]>>('/matching/candidate/matches');
    return response.data.data!;
  },

  // Get match details by ID
  getMatchById: async (matchId: string): Promise<JobMatch> => {
    const response = await matchingApi.get<ApiResponse<JobMatch>>(`/matching/matches/${matchId}`);
    return response.data.data!;
  },
};
