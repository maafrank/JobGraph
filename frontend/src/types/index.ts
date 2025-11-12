// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// User & Auth types
export type UserRole = 'candidate' | 'employer';

export interface User {
  userId: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Candidate Profile types
export interface CandidateProfile {
  profile_id: string;
  user_id: string;
  headline: string | null;
  summary: string | null;
  years_of_experience: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  remote_preference: 'onsite' | 'hybrid' | 'remote' | null;
  willing_to_relocate: boolean;
  profile_visibility: 'public' | 'private' | 'anonymous';
  resume_url: string | null;
  created_at: string;
  updated_at: string;
  education?: Education[];
  work_experience?: WorkExperience[];
}

export interface Education {
  education_id: string;
  profile_id: string;
  degree: string;
  field_of_study: string;
  institution: string;
  graduation_year: number;
  grade: string | null;
  created_at: string;
}

export interface WorkExperience {
  experience_id: string;
  profile_id: string;
  job_title: string;
  company_name: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  created_at: string;
}

// Company types
export interface Company {
  companyId: string;
  name: string;
  description: string | null;
  industry: string | null;
  companySize: string | null;
  website: string | null;
  location: {
    city: string | null;
    state: string | null;
    country: string | null;
  };
  logoUrl?: string | null;
  verified?: boolean;
  userRole?: string;
  createdAt: string;
  updatedAt?: string;
}

// Skill types
export interface Skill {
  skillId: string;
  name: string;
  category: string;
  description: string | null;
  active: boolean;
  createdAt: string;
}

export interface UserSkillScore {
  user_skill_id: string;
  user_id: string;
  skill_id: string;
  score: number;
  interview_id: string | null;
  acquired_at: string;
  expires_at: string;
  skill_name?: string;
  category?: string;
}

// Job types
export type JobStatus = 'draft' | 'active' | 'closed' | 'cancelled';
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship';
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
export type RemoteOption = 'remote' | 'hybrid' | 'onsite' | 'flexible';

export interface Job {
  jobId: string;
  companyId: string;
  postedBy: string;
  title: string;
  description: string;
  requirements: string | null;
  responsibilities?: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  remoteOption: RemoteOption;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  status: JobStatus;
  views?: number;
  requiredSkillsCount?: number;
  matchCount?: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  companyName?: string;
  companyDescription?: string;
  companyIndustry?: string;
  companySize?: string;
  companyWebsite?: string;
  requiredSkills?: JobSkill[];
}

export interface JobSkill {
  jobSkillId: string;
  jobId: string;
  skillId: string;
  weight: number;
  minimumScore: number;
  required: boolean;
  createdAt: string;
  skillName?: string;
  category?: string;
}

// Match types
export type MatchStatus = 'matched' | 'viewed' | 'contacted' | 'shortlisted' | 'rejected' | 'hired';

export interface JobMatch {
  match_id: string;
  job_id: string;
  user_id: string;
  overall_score: number;
  match_rank: number;
  status: MatchStatus;
  contacted_at: string | null;
  created_at: string;
  updated_at: string;
  job?: Job;
  candidate?: {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    profile: CandidateProfile;
  };
  skill_breakdown?: SkillBreakdown[];
}

export interface SkillBreakdown {
  skill_id: string;
  skill_name: string;
  user_score: number;
  minimum_score: number;
  weight: number;
  required: boolean;
}

// Form types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface ProfileFormData {
  headline: string;
  summary: string;
  years_of_experience: number;
  city: string;
  state: string;
  country: string;
  remote_preference: 'onsite' | 'hybrid' | 'remote';
  willing_to_relocate: boolean;
  profile_visibility: 'public' | 'private' | 'anonymous';
}

export interface CompanyFormData {
  name: string;
  description: string;
  industry: string;
  companySize: string;
  website: string;
  city: string;
  state: string;
  country: string;
}

export interface JobFormData {
  title: string;
  description: string;
  requirements: string;
  responsibilities: string;
  city: string;
  state: string;
  country: string;
  remote_option: RemoteOption;
  employment_type: EmploymentType;
  experience_level: ExperienceLevel;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
}
