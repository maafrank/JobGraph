# Resume Upload & Parsing - Implementation Plan

**Status**: Ready to implement
**Approach**: PostgreSQL BYTEA storage (Phase 1), S3 migration in Phase 4
**Timeline**: Estimated 1-2 weeks for full implementation

---

## Overview

This document outlines the plan to implement resume upload, parsing, and auto-fill functionality using PostgreSQL BYTEA storage for Phase 1. Migration to AWS S3 is deferred to Phase 4 for production scale.

---

## Architecture Decision: BYTEA vs S3

### Phase 1: PostgreSQL BYTEA (CHOSEN)

**Why BYTEA for MVP:**
- ✅ Simple architecture (no external dependencies)
- ✅ ACID transactions (file + metadata together)
- ✅ No additional costs
- ✅ Perfect for MVP scale (< 1,000 users)
- ✅ Easy development setup (no MinIO/LocalStack)
- ✅ Single backup/restore process

**Constraints:**
- File size limit: 10MB per resume
- Expected volume: < 1,000 resumes in Phase 1
- Typical resume: 100KB - 500KB
- Total storage: ~500MB max (negligible database impact)

### Phase 4: AWS S3 Migration

**When to migrate:**
- 10,000+ users
- Database bloat impacting performance
- Need CDN for global delivery
- Want versioning and lifecycle policies

**Migration strategy documented in:** [PHASE_1_CHECKLIST.md - Phase 4 Section](PHASE_1_CHECKLIST.md)

---

## Database Schema

### 1. user_documents Table

Stores uploaded files with metadata:

```sql
CREATE TABLE user_documents (
  document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,

  -- Document metadata
  document_type VARCHAR(50) NOT NULL,  -- 'resume', 'cover_letter', 'certificate'
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,  -- bytes
  mime_type VARCHAR(100) NOT NULL,  -- 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'

  -- File storage (BYTEA approach for Phase 1)
  file_data BYTEA NOT NULL,  -- Actual file binary data

  -- Version management
  is_current BOOLEAN DEFAULT true,  -- Latest version flag
  version INTEGER DEFAULT 1,

  -- Processing status
  upload_status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
  processing_error TEXT,  -- Error message if parsing failed

  -- Timestamps
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,  -- When parsing completed
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Future S3 migration fields (nullable for Phase 1)
  s3_key VARCHAR(500),  -- Will be used in Phase 4
  s3_bucket VARCHAR(100),  -- Will be used in Phase 4

  -- Constraints
  CONSTRAINT valid_document_type CHECK (document_type IN ('resume', 'cover_letter', 'certificate')),
  CONSTRAINT valid_upload_status CHECK (upload_status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Indexes
CREATE INDEX idx_user_documents_user_id ON user_documents(user_id);
CREATE INDEX idx_user_documents_current ON user_documents(user_id, is_current) WHERE is_current = true;
CREATE INDEX idx_user_documents_type ON user_documents(user_id, document_type);

-- Ensure only one current resume per user
CREATE UNIQUE INDEX idx_user_documents_current_resume
  ON user_documents(user_id, document_type)
  WHERE is_current = true AND document_type = 'resume';
```

### 2. resume_parsed_data Table

Stores extracted structured data from resumes:

```sql
CREATE TABLE resume_parsed_data (
  parsed_data_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES user_documents(document_id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,

  -- Extracted structured data (JSONB for flexibility)
  contact_info JSONB,  -- {email, phone, linkedin, github, website, city, state, country}
  summary TEXT,  -- Professional summary/objective
  skills JSONB,  -- [{skill_name, proficiency, years_experience, confidence}]
  education JSONB,  -- [{degree, field_of_study, institution, graduation_year, gpa, confidence}]
  work_experience JSONB,  -- [{title, company, start_date, end_date, is_current, description, skills_used, confidence}]
  certifications JSONB,  -- [{name, issuer, date_obtained, expiration_date, credential_id, confidence}]

  -- Raw extracted text (for reference and keyword matching)
  raw_text TEXT,

  -- Parsing metadata
  parser_used VARCHAR(50) NOT NULL,  -- 'pdf-parse', 'mammoth', 'textract', 'manual'
  confidence_score DECIMAL(3,2),  -- Overall confidence 0.00 - 1.00
  parsing_errors JSONB,  -- [{field, error, details}]

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one parsed data per document
  UNIQUE(document_id)
);

-- Indexes
CREATE INDEX idx_resume_parsed_data_user_id ON resume_parsed_data(user_id);
CREATE INDEX idx_resume_parsed_data_document_id ON resume_parsed_data(document_id);

-- GIN index for JSONB searching
CREATE INDEX idx_resume_parsed_skills ON resume_parsed_data USING GIN (skills);
CREATE INDEX idx_resume_parsed_education ON resume_parsed_data USING GIN (education);
CREATE INDEX idx_resume_parsed_experience ON resume_parsed_data USING GIN (work_experience);
```

### 3. resume_autofill_suggestions Table

Stores auto-fill suggestions from parsed data:

```sql
CREATE TABLE resume_autofill_suggestions (
  suggestion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES user_documents(document_id) ON DELETE CASCADE NOT NULL,

  -- Suggestion details
  suggestion_type VARCHAR(50) NOT NULL,  -- 'basic_info', 'education', 'work_experience', 'skills'
  suggested_data JSONB NOT NULL,  -- Actual data to apply
  target_table VARCHAR(50),  -- 'candidate_profiles', 'education', 'work_experience', 'user_skill_scores'
  target_record_id UUID,  -- If updating existing record

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected', 'applied'
  confidence DECIMAL(3,2),  -- Confidence score 0.00 - 1.00

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  applied_at TIMESTAMPTZ,  -- When user accepted suggestion

  -- Constraints
  CONSTRAINT valid_suggestion_type CHECK (suggestion_type IN ('basic_info', 'education', 'work_experience', 'skills', 'certifications')),
  CONSTRAINT valid_suggestion_status CHECK (status IN ('pending', 'accepted', 'rejected', 'applied'))
);

-- Indexes
CREATE INDEX idx_resume_suggestions_user_id ON resume_autofill_suggestions(user_id);
CREATE INDEX idx_resume_suggestions_status ON resume_autofill_suggestions(user_id, status);
CREATE INDEX idx_resume_suggestions_document ON resume_autofill_suggestions(document_id);
```

### 4. resume_shares Table

Privacy-controlled resume sharing with employers:

```sql
CREATE TABLE resume_shares (
  share_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES user_documents(document_id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NOT NULL,  -- Candidate

  -- Sharing scope
  shared_with_company_id UUID REFERENCES companies(company_id) ON DELETE CASCADE NOT NULL,
  shared_for_job_id UUID REFERENCES jobs(job_id) ON DELETE CASCADE,  -- Optional: specific job

  -- Access control
  share_status VARCHAR(50) DEFAULT 'active',  -- 'active', 'revoked', 'expired'
  access_count INTEGER DEFAULT 0,  -- Track how many times downloaded
  last_accessed_at TIMESTAMPTZ,

  -- Expiration
  expires_at TIMESTAMPTZ,  -- Auto-expire after X days

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_share_status CHECK (share_status IN ('active', 'revoked', 'expired')),

  -- Prevent duplicate shares
  UNIQUE(document_id, shared_with_company_id, shared_for_job_id)
);

-- Indexes
CREATE INDEX idx_resume_shares_user ON resume_shares(user_id);
CREATE INDEX idx_resume_shares_company ON resume_shares(shared_with_company_id);
CREATE INDEX idx_resume_shares_active ON resume_shares(user_id, share_status) WHERE share_status = 'active';
```

---

## Backend Implementation

### Phase 1: File Upload API (Profile Service)

**Dependencies to install:**

```bash
cd backend/services/profile-service
npm install multer @types/multer pdf-parse mammoth
```

**API Endpoints:**

#### 1. Upload Resume

```typescript
POST /api/v1/profiles/candidate/resume/upload
Content-Type: multipart/form-data

Request:
- Field: resume (file)

Response:
{
  success: true,
  data: {
    documentId: "uuid",
    fileName: "resume.pdf",
    fileSize: 245000,
    uploadedAt: "2025-11-11T10:00:00Z",
    uploadStatus: "processing"
  }
}
```

#### 2. Get Current Resume

```typescript
GET /api/v1/profiles/candidate/resume

Response:
{
  success: true,
  data: {
    documentId: "uuid",
    fileName: "resume.pdf",
    fileSize: 245000,
    mimeType: "application/pdf",
    uploadedAt: "2025-11-11T10:00:00Z",
    processedAt: "2025-11-11T10:00:05Z",
    uploadStatus: "completed",
    hasParsedData: true
  }
}
```

#### 3. Download Resume

```typescript
GET /api/v1/profiles/candidate/resume/download

Response:
- Content-Type: application/pdf (or appropriate mime type)
- Content-Disposition: attachment; filename="resume.pdf"
- Binary file data
```

#### 4. Delete Resume

```typescript
DELETE /api/v1/profiles/candidate/resume/:documentId

Response:
{
  success: true,
  message: "Resume deleted successfully"
}
```

### Phase 2: Resume Parsing

**Parsing Flow:**

1. **Upload** → Store in database → Return immediately
2. **Background job** → Parse file → Extract data → Store in `resume_parsed_data`
3. **Generate suggestions** → Compare with profile → Store in `resume_autofill_suggestions`
4. **Update status** → `processing` → `completed` (or `failed`)

**Parser Implementation:**

```typescript
// src/services/resumeParser.ts

import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function parseResume(documentId: string): Promise<void> {
  // 1. Fetch document from database
  const doc = await getDocument(documentId);

  // 2. Extract raw text based on file type
  let rawText: string;

  if (doc.mime_type === 'application/pdf') {
    rawText = await extractTextFromPDF(doc.file_data);
  } else if (doc.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    rawText = await extractTextFromDOCX(doc.file_data);
  } else if (doc.mime_type === 'text/plain') {
    rawText = doc.file_data.toString('utf-8');
  } else {
    throw new Error('Unsupported file type');
  }

  // 3. Extract structured data
  const parsedData = {
    contact_info: extractContactInfo(rawText),
    summary: extractSummary(rawText),
    skills: await extractSkills(rawText),
    education: extractEducation(rawText),
    work_experience: extractWorkExperience(rawText),
    certifications: extractCertifications(rawText),
    raw_text: rawText
  };

  // 4. Store parsed data
  await storeParsedData(documentId, doc.user_id, parsedData);

  // 5. Generate auto-fill suggestions
  await generateSuggestions(doc.user_id, documentId, parsedData);

  // 6. Update document status
  await updateDocumentStatus(documentId, 'completed');
}
```

### Phase 3: Auto-fill Suggestions API

**API Endpoints:**

#### 1. Get Suggestions

```typescript
GET /api/v1/profiles/candidate/resume/suggestions

Response:
{
  success: true,
  data: {
    basicInfo: [
      {
        suggestionId: "uuid",
        field: "headline",
        currentValue: null,
        suggestedValue: "Senior Software Engineer",
        confidence: 0.95
      }
    ],
    education: [
      {
        suggestionId: "uuid",
        action: "add",  // or "update"
        data: {
          degree: "Bachelor of Science",
          field_of_study: "Computer Science",
          institution: "Stanford University",
          graduation_year: 2018,
          gpa: 3.8
        },
        confidence: 0.90
      }
    ],
    workExperience: [...],
    skills: [...]
  }
}
```

#### 2. Apply Suggestion

```typescript
POST /api/v1/profiles/candidate/resume/suggestions/:suggestionId/apply

Response:
{
  success: true,
  data: {
    applied: true,
    updatedRecordId: "uuid",
    message: "Education added to profile"
  }
}
```

#### 3. Reject Suggestion

```typescript
DELETE /api/v1/profiles/candidate/resume/suggestions/:suggestionId

Response:
{
  success: true,
  message: "Suggestion rejected"
}
```

### Phase 4: Employer Resume Access

**API Endpoints:**

#### 1. Employer Views Shared Resume

```typescript
GET /api/v1/matching/candidates/:userId/resume
Authorization: Bearer <employer-token>

// Check if resume is shared with employer's company
// Return metadata or download link

Response:
{
  success: true,
  data: {
    documentId: "uuid",
    fileName: "resume.pdf",
    fileSize: 245000,
    sharedAt: "2025-11-11T10:00:00Z",
    expiresAt: "2025-12-11T10:00:00Z",
    downloadUrl: "/api/v1/matching/resumes/:shareId/download"
  }
}
```

---

## Frontend Implementation

### Component Structure

```
frontend/src/
├── components/
│   └── resume/
│       ├── ResumeUploader.tsx          # Upload component
│       ├── ResumeViewer.tsx            # Display current resume
│       ├── AutofillSuggestionsModal.tsx # Review suggestions
│       └── SuggestionCard.tsx          # Individual suggestion
├── pages/
│   └── candidate/
│       └── ProfilePage.tsx             # Add resume section
└── services/
    └── resumeService.ts                # API client
```

### 1. Resume Upload Component

**Features:**
- Drag-and-drop file upload
- File picker button
- File validation (type, size)
- Upload progress indicator
- Success/error notifications

### 2. Resume Viewer Component

**Features:**
- Display current resume info (filename, size, date)
- Download button
- Replace/delete buttons
- Parsing status indicator

### 3. Auto-fill Suggestions Modal

**Features:**
- Categorized suggestions (Basic Info, Education, Work, Skills)
- Review each suggestion before applying
- Confidence score display
- Accept/reject individual suggestions
- Bulk accept option
- Preview changes before applying

---

## Implementation Steps

### Step 1: Database Migration (1 day)

- [ ] Create migration file for 4 new tables
- [ ] Run migration in development
- [ ] Verify schema with test data
- [ ] Update DATABASE_SCHEMA.sql

### Step 2: Backend - File Upload API (2 days)

- [ ] Install dependencies (multer, pdf-parse, mammoth)
- [ ] Create upload endpoint with multer middleware
- [ ] Implement file validation
- [ ] Store file in user_documents table
- [ ] Create download endpoint
- [ ] Create delete endpoint
- [ ] Test with Postman/curl

### Step 3: Backend - Resume Parsing (3 days)

- [ ] Create resumeParser service
- [ ] Implement PDF extraction (pdf-parse)
- [ ] Implement DOCX extraction (mammoth)
- [ ] Implement plain text handling
- [ ] Create data extraction utilities:
  - [ ] Contact info (regex patterns)
  - [ ] Skills (match against skills database)
  - [ ] Education (pattern matching)
  - [ ] Work experience (pattern matching)
  - [ ] Summary extraction
- [ ] Store parsed data in database
- [ ] Error handling and logging
- [ ] Test with real resume samples

### Step 4: Backend - Auto-fill Suggestions (2 days)

- [ ] Create suggestion generator service
- [ ] Compare parsed data with current profile
- [ ] Generate suggestions for missing fields
- [ ] Store suggestions in database
- [ ] Create API endpoints:
  - [ ] GET /suggestions
  - [ ] POST /suggestions/:id/apply
  - [ ] DELETE /suggestions/:id
- [ ] Implement apply logic (insert/update profile data)
- [ ] Test suggestion flow

### Step 5: Frontend - Upload UI (2 days)

- [ ] Create ResumeUploader component
- [ ] Drag-and-drop functionality
- [ ] File validation
- [ ] Upload progress
- [ ] Create ResumeViewer component
- [ ] Integrate into ProfilePage
- [ ] Test upload/download/delete

### Step 6: Frontend - Suggestions UI (2 days)

- [ ] Create AutofillSuggestionsModal
- [ ] Create SuggestionCard component
- [ ] Implement accept/reject logic
- [ ] Preview changes
- [ ] Bulk actions
- [ ] Test full flow

### Step 7: Employer Resume Access (1 day)

- [ ] Create resume_shares logic
- [ ] Auto-share on job application
- [ ] Employer view endpoint
- [ ] Privacy checks
- [ ] Test access control

### Step 8: Testing & Polish (2 days)

- [ ] Integration tests
- [ ] E2E test script
- [ ] Multiple file format testing
- [ ] Error handling review
- [ ] Performance optimization
- [ ] Documentation

**Total Estimated Time: 15 days (3 weeks)**

---

## Testing Strategy

### Unit Tests

- File upload validation
- PDF parsing
- DOCX parsing
- Text extraction utilities
- Suggestion generation logic

### Integration Tests

- Upload → Store → Parse → Suggest flow
- Apply suggestion → Update profile
- Download resume
- Delete resume

### E2E Test Script

```bash
#!/bin/bash
# test-resume-upload.sh

# 1. Upload PDF resume
# 2. Wait for processing
# 3. Check parsed data
# 4. Get suggestions
# 5. Apply suggestion
# 6. Verify profile updated
# 7. Download resume
# 8. Delete resume
```

### Test Data

- Sample resumes in different formats (PDF, DOCX, TXT)
- Various resume layouts and styles
- Edge cases (missing sections, non-standard formats)

---

## Future Enhancements (Post Phase 1)

### Phase 2: AI-Powered Parsing

- Use Claude/Bedrock for intelligent extraction
- Better confidence scoring
- Handle non-standard resume formats
- Multi-language support

### Phase 3: Enhanced Matching

- Use resume raw_text for keyword matching
- Industry experience detection
- Certification relevance scoring
- Resume quality scoring

### Phase 4: S3 Migration

- Migrate existing files to S3
- Presigned URL implementation
- CloudFront CDN
- AWS Textract integration
- Lambda triggers for parsing

---

## Success Metrics

**Phase 1 Goals:**
- [ ] Candidates can upload resumes (PDF, DOCX, TXT)
- [ ] Basic parsing works (80%+ accuracy on structured resumes)
- [ ] Auto-fill suggestions generated
- [ ] Candidates can accept/reject suggestions
- [ ] Profile auto-populated from resume
- [ ] Employers can view shared resumes
- [ ] All integration tests passing

**Performance Targets:**
- Upload time: < 3 seconds
- Parsing time: < 5 seconds (PDF), < 3 seconds (DOCX/TXT)
- File size limit: 10MB
- Storage: < 1GB total in Phase 1

---

## Open Questions

1. **Suggestion auto-apply:** Should we auto-apply high-confidence suggestions (>0.9) or always require manual review?
   - **Decision:** Always require manual review for data accuracy

2. **Resume versioning:** Should we keep old resume versions or only the latest?
   - **Decision:** Keep version history (set is_current flag, don't delete old versions)

3. **Sharing model:** Auto-share resume on application or require explicit permission?
   - **Decision:** Auto-share on application (candidate opts-in), expires when job closes

4. **Parsing errors:** How to handle partial parsing (some sections extracted, others failed)?
   - **Decision:** Store what we can extract, flag errors in parsing_errors JSONB field

---

## Risk Mitigation

**Risk 1: PDF parsing accuracy**
- Mitigation: Support manual edits of parsed data
- Fallback: Allow candidates to enter data manually

**Risk 2: Database size growth**
- Mitigation: 10MB file limit, monitor database size
- Fallback: Early S3 migration if needed

**Risk 3: Parsing performance**
- Mitigation: Async processing (don't block upload response)
- Monitoring: Track parsing times and failures

**Risk 4: Privacy concerns**
- Mitigation: Explicit resume sharing, expiration dates
- Compliance: GDPR-compliant deletion on account removal

---

## Next Steps

**Ready to start implementation?**

1. Create database migration
2. Install backend dependencies
3. Implement upload endpoints
4. Build parsing logic
5. Create frontend components

Let me know when you're ready to begin!
