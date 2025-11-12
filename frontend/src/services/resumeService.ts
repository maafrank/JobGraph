import { profileApi } from './api';

export interface ResumeMetadata {
  documentId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  processedAt?: string;
  uploadStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  version: number;
  hasParsedData: boolean;
}

export interface ParsedResumeData {
  parsedDataId: string;
  fileName: string;
  contactInfo: {
    email?: string;
    phone?: string;
    linkedin?: string;
    github?: string;
    website?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  summary?: string;
  skills: Array<{
    skill_name: string;
    proficiency?: string;
    years_experience?: number;
    confidence: number;
  }>;
  education: any[];
  workExperience: any[];
  certifications: any[];
  parserUsed: string;
  confidenceScore: string;
  createdAt: string;
}

/**
 * Upload resume file
 */
export async function uploadResume(file: File): Promise<{ documentId: string; fileName: string; message: string }> {
  const formData = new FormData();
  formData.append('resume', file);

  const response = await profileApi.post('/profiles/candidate/resume/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.data;
}

/**
 * Get current resume metadata
 */
export async function getCurrentResume(): Promise<ResumeMetadata | null> {
  try {
    const response = await profileApi.get('/profiles/candidate/resume');
    return response.data.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null; // No resume uploaded yet
    }
    throw error;
  }
}

/**
 * Download resume file
 */
export async function downloadResume(): Promise<Blob> {
  const response = await profileApi.get('/profiles/candidate/resume/download', {
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Delete resume
 */
export async function deleteResume(documentId: string): Promise<void> {
  await profileApi.delete(`/profiles/candidate/resume/${documentId}`);
}

/**
 * Get parsed resume data
 */
export async function getParsedResumeData(): Promise<ParsedResumeData | null> {
  try {
    const response = await profileApi.get('/profiles/candidate/resume/parsed');
    return response.data.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null; // No parsed data yet
    }
    throw error;
  }
}

export interface Suggestion {
  suggestionId: string;
  suggestedData: any;
  targetTable: string;
  confidence: number;
  status: string;
  createdAt: string;
}

export interface SuggestionsResponse {
  suggestions: {
    basic_info: Suggestion[];
    education: Suggestion[];
    work_experience: Suggestion[];
    skills: Suggestion[];
  };
  totalCount: number;
}

/**
 * Get auto-fill suggestions
 */
export async function getSuggestions(): Promise<SuggestionsResponse> {
  const response = await profileApi.get('/profiles/candidate/resume/suggestions');
  return response.data.data;
}

/**
 * Apply a suggestion
 */
export async function applySuggestion(suggestionId: string): Promise<void> {
  await profileApi.post(`/profiles/candidate/resume/suggestions/${suggestionId}/apply`);
}

/**
 * Reject a suggestion
 */
export async function rejectSuggestion(suggestionId: string): Promise<void> {
  await profileApi.delete(`/profiles/candidate/resume/suggestions/${suggestionId}`);
}
