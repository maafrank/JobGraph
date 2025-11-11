// User types
export interface User {
  user_id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: 'candidate' | 'employer' | 'admin';
  email_verified: boolean;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CandidateProfile {
  profile_id: string;
  user_id: string;
  headline?: string;
  summary?: string;
  years_experience?: number;
  resume_url?: string;
  resume_parsed_data?: Record<string, any>;
  city?: string;
  state?: string;
  country?: string;
  willing_to_relocate: boolean;
  remote_preference?: 'remote' | 'hybrid' | 'onsite' | 'flexible';
  profile_visibility: 'public' | 'private' | 'anonymous';
  created_at: Date;
  updated_at: Date;
}

export interface Skill {
  skill_id: string;
  name: string;
  category: string;
  description?: string;
  active: boolean;
  created_at: Date;
}

export interface Job {
  job_id: string;
  company_id: string;
  posted_by: string;
  title: string;
  description: string;
  requirements?: string;
  city?: string;
  state?: string;
  country?: string;
  remote_option?: 'remote' | 'hybrid' | 'onsite' | 'flexible';
  salary_min?: number;
  salary_max?: number;
  salary_currency: string;
  employment_type?: 'full-time' | 'part-time' | 'contract' | 'internship';
  experience_level?: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
  status: 'draft' | 'active' | 'closed' | 'cancelled';
  views: number;
  created_at: Date;
  updated_at: Date;
  expires_at?: Date;
}

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

// JWT Payload
export interface JwtPayload {
  user_id: string;
  email: string;
  role: string;
}
