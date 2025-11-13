# Phase 2: Interview System - Completion Checklist

**Timeline**: Week 12-18 (7 weeks estimated, tracking actual progress)
**Goal**: Complete skill-based interview system with AI scoring and automated matching

---

## Overview

Phase 2 builds the core differentiator of JobGraph: candidates take skill-specific interviews **once** and use those verified scores across **all** job applications. This eliminates redundant assessments and provides employers with objective, AI-evaluated skill data.

**🎯 CRITICAL: Voice-Based Conversational AI Interviews**

JobGraph interviews are **LIVE CONVERSATIONAL INTERVIEWS** conducted by AI. Key characteristics:
- **Voice-based**: AI reads questions aloud (Text-to-Speech), candidate responds verbally (Speech-to-Text)
- **Feels like a real interview**: Natural conversation flow with cameras off
- **Personalized**: AI analyzes the candidate's resume, profile, work experience, education, and portfolio links
- **Context-aware**: Questions reference the candidate's actual projects, technologies, and experience
- **Skill-focused**: Questions target the specific skill being assessed (e.g., Python) while referencing their real work
- **Adaptive**: AI asks follow-up questions based on candidate's responses in real-time
- **Interactive**: AI can clarify, probe deeper, or move on based on the conversation

**Example Interaction**:
```
AI: "Hi Sarah, I see you've worked with Python for 3 years at TechCorp.
     Let's talk about your experience building the Flask API.
     Can you walk me through how you structured that project?"

Candidate: [speaks response]

AI: "That's interesting. You mentioned using decorators for authentication.
     Can you explain how that worked and what challenges you faced?"

Candidate: [speaks response]

AI: "Got it. Let's dig into the caching layer you mentioned..."
```

This is NOT a static questionnaire - it's a **real-time AI conversation**.

**Key Components**:
1. **Profile Context Service** (fetch candidate's full context)
2. **AI Conversation Engine** (Claude-powered real-time interviewer)
3. **Text-to-Speech (TTS)** - AI reads questions aloud
4. **Speech-to-Text (STT)** - Convert candidate voice to text
5. **Real-time conversation management** - Track dialogue flow
6. **AI evaluation and scoring** - Evaluate entire conversation holistically
7. **Skill score calculation** with percentiles
8. **Integration with matching system**
9. **Voice-enabled frontend** interview experience

---

## 1. Interview Service Foundation (Week 12)

### 1.1 Service Structure & Setup
- [ ] Create interview-service directory structure
  - [ ] `backend/services/interview-service/src/`
  - [ ] Controllers, routes, services, middleware
- [ ] Interview service package.json and tsconfig.json
- [ ] Add to backend workspace (backend/package.json)
- [ ] Create index.ts with Express server setup
- [ ] Configure service to run on port 3005
- [ ] Add to npm scripts: `npm run dev:interview`
- [ ] Add to dev-services.sh startup script
- [ ] Health check endpoint: GET /api/v1/interviews/health

### 1.2 Database Schema Updates (Context-Aware Interview System)
**⚠️ CRITICAL: Schema changes needed for AI-generated, context-aware interviews**

- [ ] Create/update interview_templates table:
  - [ ] template_id, skill_id, name, description
  - [ ] difficulty_level, duration_minutes, num_questions
  - [ ] **question_distribution (JSONB)** - e.g., {fundamental: 3, practical: 5, advanced: 4, project_specific: 3}
  - [ ] **evaluation_criteria (JSONB)** - scoring rubrics
  - [ ] active, created_at, updated_at

- [ ] Create interview_question_guidelines table (NEW):
  - [ ] guideline_id (UUID)
  - [ ] skill_id (references skills)
  - [ ] guideline_type (technical_depth, practical_application, problem_solving, best_practices, architecture)
  - [ ] guideline_text (TEXT)
  - [ ] priority (INTEGER)
  - [ ] created_at, updated_at

- [ ] Update interviews table:
  - [ ] interview_id, user_id, skill_id, template_id
  - [ ] status (in_progress, scoring_in_progress, completed, expired)
  - [ ] overall_score, started_at, completed_at, valid_until
  - [ ] **conversation_history (JSONB)** - stores entire interview conversation (AI questions + candidate responses)
  - [ ] **candidate_context (JSONB)** - snapshot of candidate's profile at interview time
  - [ ] **duration_seconds (INTEGER)** - actual interview duration
  - [ ] **REMOVE generated_questions column** - we use conversation_history instead

- [ ] Create interview_conversation_turns table (NEW for voice interviews):
  - [ ] turn_id (UUID)
  - [ ] interview_id (references interviews)
  - [ ] turn_number (INTEGER) - order in conversation
  - [ ] speaker ('ai' or 'candidate')
  - [ ] message_text (TEXT) - transcribed/generated text
  - [ ] audio_url (TEXT) - URL to stored audio (optional)
  - [ ] timestamp (TIMESTAMP)
  - [ ] ai_internal_notes (TEXT) - AI's observations about this exchange
  - [ ] created_at

- [ ] REMOVE interview_responses table (not needed for conversational interviews)

- [ ] Update interview_evaluations table:
  - [ ] evaluation_id, interview_id
  - [ ] strengths (TEXT[]), weaknesses (TEXT[])
  - [ ] **red_flags (TEXT[])** - concerning signals
  - [ ] **green_flags (TEXT[])** - exceptional strengths
  - [ ] confidence_level (0-1)
  - [ ] detailed_feedback (JSONB with skill_level, next_steps, best_fit_roles)

- [ ] Add indexes for performance:
  - [ ] Index on interviews(user_id, skill_id)
  - [ ] Index on interview_responses(interview_id)
  - [ ] GIN index on interviews.generated_questions for JSONB queries
  - [ ] GIN index on interviews.candidate_context for JSONB queries
  - [ ] Index on interview_question_guidelines(skill_id)

### 1.3 Profile Context Service
- [ ] Create ProfileContextService class
- [ ] fetchCandidateContext(userId, skillId) function
  - [ ] Fetch candidate profile (headline, summary, location, years_experience)
  - [ ] Fetch education (degrees, fields of study, institutions)
  - [ ] Fetch work experience (job titles, companies, descriptions, technologies)
  - [ ] Fetch resume data (if available from resume_parsed_data table)
  - [ ] Fetch social links (LinkedIn, GitHub, portfolio)
  - [ ] Fetch existing skill scores (manual and interview-based)
  - [ ] Return comprehensive context object
- [ ] analyzeCandidateForSkill(context, skillId) function
  - [ ] Use Claude AI to analyze profile and identify:
    - [ ] Projects that used this skill
    - [ ] Specific technologies/frameworks mentioned
    - [ ] Experience level indicators
    - [ ] Depth of expertise signals
  - [ ] Return structured analysis for question generation

### 1.4 AI Interview Template System
**⚠️ NOTE: We do NOT use static question banks. Questions are generated dynamically by AI.**

- [ ] Create interview_question_guidelines table (seed data)
  - [ ] skill_id, guideline_type, guideline_text, priority
  - [ ] Types: 'technical_depth', 'practical_application', 'problem_solving', 'best_practices', 'architecture'
- [ ] Seed interview guidelines for each skill:
  - [ ] **Python**: Focus on OOP, async programming, libraries used, performance optimization, testing
  - [ ] **JavaScript**: Focus on ES6+ features, async patterns, frameworks, DOM manipulation, tooling
  - [ ] **Machine Learning**: Focus on model selection, data preprocessing, evaluation metrics, production deployment
  - [ ] **SQL**: Focus on query optimization, indexing, schema design, transactions, performance
  - [ ] **React**: Focus on component design, state management, hooks, performance, testing
- [ ] Create interview templates (configuration only, no static questions)
  - [ ] template_id, skill_id, name, duration_minutes, num_questions
  - [ ] question_distribution: { fundamental: 3, practical: 5, advanced: 4, project_specific: 3 }
  - [ ] evaluation_criteria: JSON with scoring rubrics for depth, accuracy, clarity

### 1.5 Voice Integration Setup
- [ ] **Text-to-Speech (TTS) Service**
  - [ ] Choose TTS provider:
    - [ ] Option 1: AWS Polly (integrated with Bedrock, good voice quality)
    - [ ] Option 2: ElevenLabs (best quality, more expensive)
    - [ ] Option 3: Google Cloud TTS (good balance)
  - [ ] Install TTS SDK
  - [ ] Create TTSService class
  - [ ] convertTextToSpeech(text, voice) function
    - [ ] Use natural, professional voice (e.g., "Matthew" or "Joanna" in AWS Polly)
    - [ ] Return audio stream or URL
  - [ ] Test voice quality and naturalness

- [ ] **Speech-to-Text (STT) Service**
  - [ ] Choose STT provider:
    - [ ] Option 1: Browser Web Speech API (free, works in Chrome/Edge)
    - [ ] Option 2: AWS Transcribe (realtime streaming)
    - [ ] Option 3: Deepgram (excellent accuracy for technical terms)
  - [ ] Create STTService class (if using server-side)
  - [ ] For browser-based: Implement WebRTC or Web Speech API
  - [ ] Handle real-time transcription
  - [ ] Handle technical terminology correctly (Python, JavaScript, React, etc.)

### 1.6 AI Conversation Engine
**⚠️ CRITICAL: This is the heart of the system - a real-time AI interviewer**

- [ ] Create AIConversationEngine class
- [ ] startInterview(userId, skillId) function
  - [ ] Fetch candidate context using ProfileContextService
  - [ ] Fetch interview guidelines for skill
  - [ ] Initialize conversation with Claude AI (streaming mode)
  - [ ] Generate opening statement:
    ```
    "Hi [name], thanks for joining. I've reviewed your profile and I'm excited
     to learn more about your [skill] experience. This will be a conversational
     interview lasting about [duration] minutes. Let's start with your work at
     [company] on the [project]. Can you tell me about that?"
    ```
  - [ ] Convert opening to speech (TTS)
  - [ ] Store conversation state in interviews.conversation_history (JSONB)
  - [ ] Return audio URL/stream for AI's first question

- [ ] processResponse(interviewId, candidateResponse) function
  - [ ] Append candidate's response to conversation history
  - [ ] Call Claude AI with full conversation context:
    ```
    You are a technical interviewer conducting a [SKILL] interview.

    CANDIDATE CONTEXT:
    [full profile, work history, projects]

    INTERVIEW GUIDELINES:
    [skill-specific focus areas]

    CONVERSATION SO FAR:
    [all previous exchanges]

    CANDIDATE'S LATEST RESPONSE:
    "[candidateResponse]"

    Your task:
    1. Analyze their response for technical depth and accuracy
    2. Decide next move:
       - Ask clarifying follow-up if response was vague
       - Probe deeper into interesting technical details
       - Move to new topic if sufficiently covered
       - End interview if time is up or all areas covered
    3. Generate your next question/statement
    4. Keep conversation natural and encouraging

    Return JSON: {
      next_question: "...",
      should_continue: true/false,
      internal_notes: "observations about candidate's knowledge"
    }
    ```
  - [ ] Parse AI response
  - [ ] Convert next_question to speech (TTS)
  - [ ] Update conversation_history
  - [ ] Return audio URL/stream + should_continue flag

- [ ] endInterview(interviewId) function
  - [ ] Generate closing statement
  - [ ] Save final conversation transcript
  - [ ] Trigger evaluation process
  - [ ] Return closing audio

### 1.6 Testing
- [ ] Test script: `scripts/test-interview-generation.sh`
- [ ] Test profile context fetching
  - [ ] Fetch complete candidate profile with all related data
  - [ ] Verify resume parsing data is included
  - [ ] Test with candidates who have different experience levels
- [ ] Test AI question generation
  - [ ] Generate questions for Python skill (test user with Python projects)
  - [ ] Verify questions reference candidate's actual work
  - [ ] Verify question distribution matches template config
  - [ ] Test with candidates who have minimal profile data
  - [ ] Test with candidates who have extensive profile data
- [ ] Test interview template configuration
  - [ ] Create templates for all 5 skills
  - [ ] Verify question distribution settings
  - [ ] Verify evaluation criteria are properly structured

---

## 2. Conversational Interview Session Management (Week 13)

### 2.1 Start Interview Flow (Voice-Based)
- [ ] POST /api/v1/interviews/start - Start conversational interview
  - [ ] Require authentication
  - [ ] Input: { skillId }
  - [ ] Check if user already has active interview for skill (reject if yes)
  - [ ] Check if user has valid (non-expired) score for skill
    - [ ] If expired, allow retake
    - [ ] If valid, reject with error message
  - [ ] Get active template for skill (reject if none found)
  - [ ] **Call AIConversationEngine.startInterview(userId, skillId)**
    - [ ] Fetches profile context
    - [ ] Generates personalized opening statement
    - [ ] Converts to speech (TTS)
  - [ ] Create interview record with status='in_progress'
  - [ ] Store candidate context snapshot in interviews.candidate_context (JSONB)
  - [ ] Initialize empty conversation_history array
  - [ ] Create first turn in interview_conversation_turns (AI's opening)
  - [ ] Return: { interviewId, audioUrl, openingText, duration }
- [ ] Implement UNIQUE constraint enforcement (one active interview per user per skill)
- [ ] Add interview start timestamp tracking

### 2.2 Conversation Turn Submission (Voice Response)
- [ ] POST /api/v1/interviews/:interviewId/respond - Submit candidate's voice response
  - [ ] Require authentication and ownership check
  - [ ] Input: { audioBlob } or { transcribedText } (if client-side STT)
  - [ ] Verify interview is in 'in_progress' status
  - [ ] If audio provided:
    - [ ] Convert speech to text (STT)
    - [ ] Store audio file (optional, for record-keeping)
  - [ ] Save candidate's response in interview_conversation_turns
  - [ ] Append to interviews.conversation_history
  - [ ] **Call AIConversationEngine.processResponse(interviewId, candidateResponse)**
    - [ ] AI analyzes response
    - [ ] AI generates next question or ends interview
    - [ ] Converts AI response to speech
  - [ ] Save AI's next question in interview_conversation_turns
  - [ ] Return: { audioUrl, questionText, shouldContinue, turnNumber }
- [ ] Handle long responses (break into chunks if needed)
- [ ] Handle silence detection (prompt candidate if no response after 10 seconds)
- [ ] Real-time audio streaming support (WebSocket for low latency)

### 2.3 Interview Completion
- [ ] POST /api/v1/interviews/:interviewId/end - End interview
  - [ ] Can be triggered by AI (time up or coverage complete)
  - [ ] Can be triggered by candidate (quit early)
  - [ ] Require authentication and ownership check
  - [ ] Update interview status to 'completed'
  - [ ] Set completed_at timestamp
  - [ ] Calculate duration_seconds
  - [ ] Generate AI's closing statement
  - [ ] Convert to speech
  - [ ] Save closing turn
  - [ ] Trigger evaluation process (async)
  - [ ] Return: { closingAudioUrl, closingText, message: "Your interview is being evaluated..." }
- [ ] Transaction handling (rollback if evaluation trigger fails)

### 2.4 Mid-Interview Pause/Resume
- [ ] POST /api/v1/interviews/:interviewId/pause - Pause interview
  - [ ] Save current state
  - [ ] Set status to 'paused'
  - [ ] Return current conversation state
- [ ] POST /api/v1/interviews/:interviewId/resume - Resume interview
  - [ ] Load conversation history
  - [ ] Generate "welcome back" message
  - [ ] Continue from where left off

### 2.4 Interview Status & Retrieval
- [ ] GET /api/v1/interviews/:interviewId - Get interview with questions and answers
  - [ ] Require authentication and ownership check
  - [ ] Return interview details, questions, and user's answers
  - [ ] If status='completed', include scores
  - [ ] Do NOT include correct answers or rubrics (unless completed)
- [ ] GET /api/v1/interviews/user/history - Get user's interview history
  - [ ] Return all interviews (in_progress, completed, expired)
  - [ ] Include skill name, status, score, dates
  - [ ] Sort by started_at DESC
  - [ ] Pagination support
- [ ] GET /api/v1/interviews/skills/:skillId/status - Check if user can take interview
  - [ ] Return: canTake (boolean), reason (if false)
  - [ ] Reasons: active interview exists, valid score exists, no template available

### 2.5 Testing
- [ ] Test script: `scripts/test-interview-session.sh`
- [ ] Test starting interview (success cases)
- [ ] Test starting interview (rejection cases)
  - [ ] Already have active interview
  - [ ] Already have valid score
  - [ ] No template for skill
- [ ] Test answer submission (create and update)
- [ ] Test interview submission
  - [ ] Success (all questions answered)
  - [ ] Failure (missing answers)
- [ ] Test interview retrieval
- [ ] Test interview history listing

---

## 3. Automated Scoring - Multiple Choice & Coding (Week 14)

### 3.1 Multiple Choice Scoring
- [ ] Create ScoringService class
- [ ] scoreMultipleChoice(response) function
  - [ ] Compare user answer to correct_answer (case-insensitive, trim whitespace)
  - [ ] Return full points if correct, 0 if incorrect
- [ ] Integrate into interview submission flow
- [ ] Update interview_responses.score for each MCQ
- [ ] Calculate partial overall_score (MCQ + coding only, open-ended scored later)

### 3.2 Code Execution Service - Judge0 Integration
- [ ] Sign up for Judge0 API (RapidAPI) or self-host
- [ ] Add environment variables:
  - [ ] JUDGE0_API_URL
  - [ ] JUDGE0_API_KEY (if using RapidAPI)
- [ ] Install axios for HTTP requests
- [ ] Create CodeExecutionService class
- [ ] executeCode(code, language, input) function
  - [ ] Submit code to Judge0 API
  - [ ] Base64 encode source code and stdin
  - [ ] Set language_id (71=Python, 63=Node.js, etc.)
  - [ ] Poll for result (max 10 attempts, 500ms intervals)
  - [ ] Return { success, output, error, stderr }
- [ ] getLanguageId(language) helper function
  - [ ] Map skill names to Judge0 language IDs
  - [ ] Support: Python, JavaScript, Java, C++, Go, SQL
- [ ] Handle execution errors gracefully
  - [ ] Timeout (status code 5)
  - [ ] Compilation error (status code 6)
  - [ ] Runtime error (status code 11-14)
- [ ] Add execution time and memory limits

### 3.3 Coding Question Scoring
- [ ] scoreCodingQuestion(response) function
  - [ ] Parse test_cases from question (JSON array)
  - [ ] For each test case: execute code with input, compare output to expected
  - [ ] Track passed/failed test cases
  - [ ] Calculate score: (passedTests / totalTests) * points
  - [ ] Store detailed results in ai_feedback (which test cases passed/failed)
- [ ] Normalize outputs before comparison
  - [ ] Trim whitespace
  - [ ] Ignore trailing newlines
  - [ ] Case-insensitive for string outputs (if specified)
- [ ] Timeout handling (max 5 seconds per test case)

### 3.4 Scoring Orchestration
- [ ] scoreInterview(interviewId) function
  - [ ] Get all responses for interview
  - [ ] For each response:
    - [ ] If question_type='multiple_choice': score immediately
    - [ ] If question_type='coding': execute and score
    - [ ] If question_type='open_ended': set score=0 (will be scored by AI later)
  - [ ] Update interview_responses.score for each response
  - [ ] Calculate overall_score (percentage): (total_score / total_points) * 100
  - [ ] Update interviews.overall_score
  - [ ] Return { overallScore, totalScore, totalPoints }
- [ ] Trigger scoring automatically after interview submission
- [ ] Error handling (if scoring fails, set interview status to 'error')

### 3.5 Testing
- [ ] Test script: `scripts/test-interview-scoring.sh`
- [ ] Test MCQ scoring
  - [ ] Correct answer = full points
  - [ ] Incorrect answer = 0 points
  - [ ] Case-insensitive matching works
- [ ] Test coding execution with Judge0
  - [ ] Simple test: print "Hello World"
  - [ ] Test with input: read number, print double
  - [ ] Test with multiple test cases
  - [ ] Test compilation error handling
  - [ ] Test runtime error handling
  - [ ] Test timeout handling
- [ ] Test coding question scoring
  - [ ] All test cases pass = full points
  - [ ] Partial pass = proportional points
  - [ ] All fail = 0 points
- [ ] Test full interview scoring flow
  - [ ] Submit interview → scoring triggered → scores calculated
  - [ ] Overall score calculated correctly
- [ ] Manual testing: Complete a real interview with mixed question types

---

## 4. AI-Powered Evaluation (Week 15-16)

### 4.1 AWS Bedrock Setup
- [ ] Install AWS SDK: `npm install @aws-sdk/client-bedrock-runtime`
- [ ] Configure AWS credentials (IAM user or role)
  - [ ] AWS_ACCESS_KEY_ID
  - [ ] AWS_SECRET_ACCESS_KEY
  - [ ] AWS_REGION (use us-east-1 for Bedrock)
- [ ] Request access to Claude 3.5 Sonnet model in AWS Bedrock console
  - [ ] Model ID: `anthropic.claude-3-5-sonnet-20240620-v1:0`
- [ ] Test Bedrock connection with simple prompt
- [ ] Verify API quotas and rate limits

### 4.2 AI Evaluation Service (Context-Aware)
- [ ] Create AIEvaluationService class
- [ ] evaluateResponse(interviewId, question, answer, candidateContext) function
  - [ ] **CRITICAL**: Evaluation must be context-aware
  - [ ] Retrieve candidate_context stored during interview start
  - [ ] Construct comprehensive evaluation prompt:
    ```
    You are evaluating a technical interview response.

    CANDIDATE CONTEXT:
    - Name: [name]
    - Experience: [years_experience] years in [skill]
    - Relevant Work: [specific projects/roles using this skill]
    - Education: [relevant degrees]
    - Technologies: [specific technologies they've used]

    QUESTION:
    [question_text]

    CANDIDATE'S ANSWER:
    [answer]

    EVALUATION CRITERIA:
    [evaluation_criteria from question generation]

    Evaluate this answer considering:
    1. Technical accuracy and depth
    2. How well they explained their specific contributions
    3. Understanding of technologies/frameworks they mentioned
    4. Clarity of communication
    5. Problem-solving approach demonstrated
    6. Practical experience signals vs theoretical knowledge

    Return JSON: { score: 0-100, reasoning: string, strengths: [], improvements: [], confidence: 0-1 }
    ```
  - [ ] Call Claude 3.5 Sonnet via Bedrock InvokeModelCommand
  - [ ] Parse JSON from Claude's response (handle markdown code blocks)
  - [ ] Return { score, feedback (JSON string), confidence }
- [ ] Handle Bedrock API errors gracefully
  - [ ] Timeout (use 30-second timeout)
  - [ ] Rate limiting (implement exponential backoff)
  - [ ] Invalid response (retry once, fallback to default score of 50)
- [ ] Prompt engineering best practices
  - [ ] Always include candidate context for personalized evaluation
  - [ ] Request structured JSON output
  - [ ] Include examples of good vs poor answers in prompt (few-shot learning)
  - [ ] Specify fairness and consistency requirements
  - [ ] Account for different experience levels in scoring

### 4.3 Evaluate All Responses (Context-Aware)
- [ ] evaluateAllResponses(interviewId) function
  - [ ] **NOTE**: ALL questions are evaluated by AI (including MCQ and coding for reasoning)
  - [ ] Retrieve candidate_context from interview record
  - [ ] Retrieve generated_questions from interview record
  - [ ] For each response:
    - [ ] Call evaluateResponse() with interview context, question, answer, and candidate_context
    - [ ] Update interview_responses.score with AI score
    - [ ] Store AI feedback in interview_responses.ai_feedback (JSONB)
  - [ ] AI can provide nuanced scoring:
    - [ ] For coding: evaluate approach, code quality, not just correctness
    - [ ] For open-ended: evaluate depth, accuracy, real experience signals
    - [ ] For profile-specific questions: verify claimed experience matches their explanation
  - [ ] Recalculate overall interview score (weighted average across all questions)
  - [ ] Update interviews.overall_score
- [ ] Batch processing (limit parallel API calls to avoid rate limits)
- [ ] Progress tracking (log evaluation progress for debugging)

### 4.4 Overall Interview Evaluation (Holistic Assessment)
- [ ] generateOverallEvaluation(interviewId) function
  - [ ] Retrieve candidate_context from interview
  - [ ] Get all responses with scores and AI feedback
  - [ ] Aggregate strengths from all questions (top 5)
  - [ ] Aggregate weaknesses/improvements from all questions (top 5)
  - [ ] Calculate average confidence level
  - [ ] Generate overall assessment using Claude with FULL context:
    ```
    You interviewed a candidate for [SKILL].

    CANDIDATE PROFILE:
    [full candidate context]

    INTERVIEW QUESTIONS & RESPONSES:
    [all questions asked and their answers]

    INDIVIDUAL QUESTION SCORES:
    [scores and feedback for each question]

    Provide a holistic evaluation:
    1. Overall skill level (beginner/intermediate/advanced/expert)
    2. Key strengths demonstrated
    3. Areas for improvement
    4. Confidence in this assessment (0-1)
    5. Recommended next steps for the candidate
    6. Red flags (if any) - e.g., claimed experience doesn't match answers
    7. Green flags - e.g., exceptional depth in specific areas
    8. Best fit for what types of roles/projects

    Return JSON with all fields above.
    ```
  - [ ] Store in interview_evaluations table
- [ ] Insert or update interview_evaluations record
  - [ ] strengths (TEXT[])
  - [ ] weaknesses (TEXT[])
  - [ ] red_flags (TEXT[]) - new field
  - [ ] green_flags (TEXT[]) - new field
  - [ ] confidence_level (0-1)
  - [ ] detailed_feedback (JSONB with skill_level, next_steps, best_fit_roles)

### 4.5 Scoring Pipeline Integration
- [ ] Update scoreInterview() to call AI evaluation after MCQ/coding scoring
- [ ] Workflow:
  1. Score MCQ and coding questions immediately
  2. Calculate partial overall_score
  3. Trigger AI evaluation for open-ended questions (async)
  4. Recalculate final overall_score
  5. Generate overall evaluation
  6. Update interview status to 'evaluated'
- [ ] Add interview status: 'scoring_in_progress', 'evaluated'
- [ ] Allow user to view partial results while AI evaluation is in progress

### 4.6 Testing
- [ ] Test script: `scripts/test-ai-evaluation.sh`
- [ ] Test Bedrock connection and authentication
- [ ] Test single response evaluation
  - [ ] Good answer (should score 75+)
  - [ ] Mediocre answer (should score 40-60)
  - [ ] Poor answer (should score <40)
- [ ] Test evaluation consistency
  - [ ] Same answer evaluated twice should get similar scores (within 10 points)
- [ ] Test full interview evaluation
  - [ ] Mixed quality answers
  - [ ] Verify strengths and weaknesses are extracted
  - [ ] Verify overall assessment is generated
- [ ] Test error handling
  - [ ] Invalid API credentials
  - [ ] Malformed response from Claude
  - [ ] Timeout scenario
- [ ] Cost tracking: Log token usage and calculate costs
- [ ] Manual review: Check 10 AI evaluations for fairness and accuracy

---

## 5. Skill Scores & Matching Integration (Week 17)

### 5.1 Skill Score Calculation
- [ ] Create SkillScoreService class
- [ ] calculateSkillScore(interviewId) function
  - [ ] Verify interview status is 'completed' or 'evaluated'
  - [ ] Get interview details (user_id, skill_id, overall_score)
  - [ ] Calculate percentile among all users with this skill
    - [ ] Query user_skill_scores WHERE skill_id=$1 AND score<$2 AND expires_at>NOW()
    - [ ] Percentile = (usersWithLowerScore / totalUsers) * 100
    - [ ] Default to 50th percentile if no other users have this skill yet
  - [ ] Set expiry date (6 months from now)
  - [ ] Upsert user_skill_scores table
    - [ ] ON CONFLICT (user_id, skill_id) DO UPDATE
    - [ ] Update interview_id, score, percentile, created_at, expires_at
  - [ ] Update interviews.valid_until
  - [ ] Return { score, percentile, expiresAt }
- [ ] Trigger skill score calculation after AI evaluation completes

### 5.2 Replace Manual Skill Scores in Matching
- [ ] Update Matching Service to prioritize interview-based scores
- [ ] Modify calculateJobMatches() function:
  - [ ] Only consider user_skill_scores with interview_id NOT NULL (verified scores)
  - [ ] Fallback to manual scores if no interview score exists (for Phase 1 compatibility)
  - [ ] Check expires_at > NOW() to ensure scores are still valid
- [ ] Add "score source" indicator in match results
  - [ ] 'interview' (verified via interview)
  - [ ] 'manual' (self-reported in Phase 1)
  - [ ] Employers can filter/sort by verified scores only

### 5.3 Trigger Matching After Skill Score Update
- [ ] Create event system or direct function call
- [ ] After calculateSkillScore() completes:
  - [ ] Find all active jobs that require this skill
    - [ ] Query: SELECT DISTINCT job_id FROM job_skills WHERE skill_id=$1 AND EXISTS (SELECT 1 FROM jobs WHERE job_id=job_skills.job_id AND status='active')
  - [ ] For each job: recalculate matches (call calculateJobMatches)
  - [ ] Identify "new high-quality matches" (score >= 80% and rank in top 10)
- [ ] Store matching trigger event in logs for debugging

### 5.4 Percentile & Benchmark Data
- [ ] Add percentile display in skill scores
- [ ] Create benchmark table (optional for Phase 2+)
  - [ ] skill_benchmarks: skill_id, percentile_25, percentile_50, percentile_75, percentile_90, sample_size
  - [ ] Update daily via scheduled job
- [ ] Display percentile context to candidates
  - [ ] "You scored better than 73% of candidates who took this assessment"
- [ ] Display percentile to employers in candidate matches
  - [ ] "Candidate is in the top 10% for Python"

### 5.5 Testing
- [ ] Test script: `scripts/test-skill-scores.sh`
- [ ] Test skill score calculation
  - [ ] Complete interview → score calculated → stored in user_skill_scores
  - [ ] Verify percentile calculation (with multiple users)
  - [ ] Verify expiry date is set to 6 months from now
- [ ] Test matching integration
  - [ ] Complete interview → skill score updated → matching triggered
  - [ ] Verify job matches are recalculated
  - [ ] Verify match scores reflect interview results
- [ ] Test score expiry handling
  - [ ] Manually set expires_at to past date
  - [ ] Verify candidate can retake interview
  - [ ] Verify expired scores are excluded from matching
- [ ] Test percentile edge cases
  - [ ] First user with skill (should default to 50th percentile)
  - [ ] Perfect score (should be 100th percentile if not alone)

---

## 6. Frontend Interview Experience (Week 18)

### 6.1 Interview Discovery & Start
- [ ] **Available Interviews Page** (`/candidate/interviews`)
  - [ ] List all skills available for interviews
  - [ ] Show skill name, category, description
  - [ ] Display interview duration and difficulty level
  - [ ] Show user's current status for each skill:
    - [ ] "Not Started" - Can take interview
    - [ ] "In Progress" - Resume interview button
    - [ ] "Completed" - View results button
    - [ ] "Valid Score" - Score badge, expiry date, retake disabled
    - [ ] "Expired" - Retake interview button
  - [ ] Filter by category (programming, data_science, cloud, ai, finance)
  - [ ] Search by skill name
  - [ ] "Start Interview" button (disabled if already completed or in progress)
- [ ] **Interview Start Modal**
  - [ ] Display skill name and description
  - [ ] Show estimated duration
  - [ ] Show number of questions and breakdown (X MCQ, Y coding, Z open-ended)
  - [ ] Warning: "You can only take this interview once every 6 months"
  - [ ] "Start Now" button → navigates to interview page

### 6.2 Voice Interview Interface
**⚠️ CRITICAL: This is a VOICE-BASED interview, not a form**

- [ ] **Interview Page Layout** (`/candidate/interviews/:interviewId/voice`)
  - [ ] Clean, minimal design (like a video call interface)
  - [ ] Top bar with:
    - [ ] Skill name
    - [ ] Overall timer (countdown from duration)
    - [ ] "Pause Interview" button
    - [ ] "End Interview" button
  - [ ] Center area:
    - [ ] Large AI avatar or waveform animation (shows AI is "speaking")
    - [ ] Live transcript display (shows conversation as it happens)
    - [ ] Auto-scroll to latest message
  - [ ] Bottom area:
    - [ ] Microphone button (push-to-talk or toggle)
    - [ ] Recording indicator when candidate is speaking
    - [ ] Audio visualization (waveform when speaking)

- [ ] **Voice Interaction Components**
  - [ ] Install audio libraries:
    - [ ] `npm install react-mic` (for recording)
    - [ ] `npm install wavesurfer.js` (for visualization)
  - [ ] AudioPlayer component:
    - [ ] Plays AI's questions automatically
    - [ ] Shows loading state while AI generates response
    - [ ] Controls: play, pause (for replaying AI's question)
  - [ ] VoiceRecorder component:
    - [ ] Records candidate's voice
    - [ ] Push-to-talk: Hold button to speak, release to send
    - [ ] OR toggle: Click to start recording, click again to stop and send
    - [ ] Visual feedback during recording (waveform, timer)
    - [ ] "Re-record" option before sending
  - [ ] TranscriptDisplay component:
    - [ ] Shows conversation history
    - [ ] AI messages in one color, candidate in another
    - [ ] Timestamps for each turn
    - [ ] Scrollable, auto-scrolls to latest

- [ ] **Speech Integration (Client-Side)**
  - [ ] Implement Web Speech API for STT (browser-based):
    ```javascript
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.interimResults = true; // Show results as user speaks
    recognition.continuous = false; // Stop after user finishes
    ```
  - [ ] Convert speech to text in real-time
  - [ ] Show interim results (what AI "hears" as you speak)
  - [ ] Handle recognition errors gracefully
  - [ ] Fallback to manual text input if speech not supported/working

- [ ] **Audio Playback**
  - [ ] Play AI's audio response automatically when received
  - [ ] Show loading animation while waiting for AI response
  - [ ] "Replay" button to hear question again
  - [ ] Volume controls
  - [ ] Handle audio loading errors

- [ ] **Interview Flow Management**
  - [ ] State machine for interview states:
    - [ ] 'waiting_for_ai' - AI is thinking/generating question
    - [ ] 'ai_speaking' - AI's audio is playing
    - [ ] 'candidate_turn' - Waiting for candidate to respond
    - [ ] 'candidate_speaking' - Recording candidate's response
    - [ ] 'processing_response' - Sending audio to backend
  - [ ] Smooth transitions between states
  - [ ] Disable mic during AI's turn
  - [ ] Show appropriate UI for each state

- [ ] **Accessibility & UX**
  - [ ] Keyboard shortcuts (spacebar to talk, Esc to pause)
  - [ ] Mobile-friendly (large buttons, responsive)
  - [ ] Clear visual indicators (who's speaking, what to do next)
  - [ ] Error messages for mic access issues
  - [ ] Tutorial/demo before first interview ("Here's how this works...")
  - [ ] Option to read transcript if can't hear audio

### 6.3 Interview Completion & Results
- [ ] **Interview Ends Automatically or Manually**
  - [ ] AI decides interview is complete (time up or all topics covered)
  - [ ] OR candidate clicks "End Interview" button
  - [ ] Play AI's closing statement: "Thank you for your time today, [name]. Your responses will be evaluated and you'll receive your results shortly."
  - [ ] Show completion message
  - [ ] Navigate to results pending page
- [ ] **Results Pending Page** (`/candidate/interviews/:interviewId/pending`)
  - [ ] "Your interview is being evaluated..." message
  - [ ] Animated loading indicator
  - [ ] Estimated time: "Results will be available in 2-5 minutes"
  - [ ] Auto-refresh every 10 seconds to check if results are ready
  - [ ] Redirect to results page when evaluation is complete
- [ ] **Interview Results Page** (`/candidate/interviews/:interviewId/results`)
  - [ ] Overall score card (large, prominent display)
    - [ ] Score: X/100
    - [ ] Percentile: "You scored better than X% of candidates"
    - [ ] Visual: Circular progress chart or gauge
  - [ ] Skill level badge (Beginner, Intermediate, Advanced, Expert)
  - [ ] Score expiry date: "Valid until [date]"
  - [ ] Strengths section (list of 5 top strengths from evaluation)
  - [ ] Areas for Improvement section (list of 5 areas to work on)
  - [ ] Question-by-Question Breakdown (expandable accordion)
    - [ ] For each question: question text, your answer, score, AI feedback (if available)
    - [ ] Color-coded scores (green=high, yellow=medium, red=low)
  - [ ] Recommended Next Steps section (from AI evaluation)
  - [ ] "View Job Matches" button (navigate to jobs that match this skill)
  - [ ] "Share Results" button (future: social sharing, for now just copy link)
  - [ ] "Retake Interview" button (disabled if score is still valid)

### 6.4 Interview History & Management
- [ ] **My Interviews Page** (`/candidate/interviews/history`)
  - [ ] List all interviews taken (past and in progress)
  - [ ] For each interview: skill name, status, score (if completed), date taken, expiry date
  - [ ] Filter by status (all, in progress, completed, expired)
  - [ ] Sort by date taken (newest first)
  - [ ] Action buttons:
    - [ ] "Resume Interview" (if in progress)
    - [ ] "View Results" (if completed)
    - [ ] "Retake Interview" (if expired or >6 months old)
  - [ ] Empty state: "You haven't taken any interviews yet. Start your first interview!"
- [ ] **Integration with Dashboard**
  - [ ] Add "Interviews Completed" count to candidate dashboard
  - [ ] Show most recent interview result on dashboard
  - [ ] Quick action button: "Take a New Interview"
- [ ] **Integration with Skills Page**
  - [ ] Show "Interview Score" badge next to skills in "My Skills" tab
  - [ ] Indicate if score is from interview (verified) vs manual entry
  - [ ] Link to interview results page from skill entry

### 6.5 Testing
- [ ] Manual end-to-end testing
  - [ ] Browse available interviews
  - [ ] Start interview for Python
  - [ ] Answer all questions (mix of MCQ, coding, open-ended)
  - [ ] Test auto-save functionality (refresh page, answers should persist)
  - [ ] Submit interview
  - [ ] Wait for AI evaluation to complete
  - [ ] View results page
  - [ ] Check that skill score is updated in My Skills page
  - [ ] Check that job matches are recalculated
- [ ] Test edge cases
  - [ ] Try to start interview when already have valid score (should be blocked)
  - [ ] Try to submit interview with missing answers (should show validation error)
  - [ ] Test timer expiration (if time runs out, what happens?)
  - [ ] Test browser refresh during interview (should resume from where left off)
- [ ] Responsive design testing (mobile, tablet, desktop)
- [ ] Code editor usability testing (font size, themes, line numbers)
- [ ] Accessibility testing (keyboard navigation, screen reader compatibility)

---

## 7. Advanced Features & Polish

### 7.1 Interview Analytics (Optional for Phase 2)
- [ ] Employer view: See interview pass rates for required skills
- [ ] Candidate view: See how your score compares to others who applied to same job
- [ ] Admin dashboard: Track interview completion rates, average scores per skill, drop-off points

### 7.2 Notifications (Integration with Phase 1)
- [ ] Email notification when interview results are ready
- [ ] Email notification when new job matches are found after completing interview
- [ ] In-app notification for interview reminders (if user starts but doesn't complete)

### 7.3 Interview Integrity & Security
- [ ] Tab switching detection (warn user if they switch tabs during interview)
- [ ] Copy-paste detection for coding questions (log but don't block)
- [ ] Plagiarism detection for open-ended questions (compare against previous answers, use AI)
- [ ] Time limit enforcement (auto-submit if time expires)
- [ ] Prevent multiple simultaneous interviews from same user

### 7.4 Scheduled Jobs
- [ ] Daily job: Recalculate all active job matches (EventBridge + Lambda)
- [ ] Weekly job: Update skill percentile benchmarks
- [ ] Daily job: Send reminder emails for interviews in progress (>24 hours since start)
- [ ] Weekly job: Mark expired interviews and notify candidates to retake

---

## 8. Integration Testing

### 8.1 End-to-End Interview Flow
- [ ] Test script: `scripts/test-interview-e2e.sh`
- [ ] Complete interview flow (start → answer → submit → score → results)
- [ ] Verify skill score is created in user_skill_scores
- [ ] Verify matching is triggered and matches are updated
- [ ] Test for 3 different skills (Python, JavaScript, Machine Learning)
- [ ] Verify interview history displays correctly
- [ ] Verify "retake" flow works after expiry

### 8.2 Multi-User Testing
- [ ] Create 10 test users
- [ ] Have all 10 complete Python interview
- [ ] Verify percentile calculations are correct
- [ ] Verify matching works for all users
- [ ] Check for race conditions in scoring

### 8.3 Performance Testing
- [ ] Test AI evaluation latency (should be <30 seconds per interview)
- [ ] Test code execution latency (should be <5 seconds per test case)
- [ ] Test concurrent interview submissions (10 users submit at same time)
- [ ] Monitor Bedrock API costs per interview
- [ ] Monitor Judge0 API usage and costs

### 8.4 Error Handling & Edge Cases
- [ ] Test interview submission with network failure (should retry)
- [ ] Test AI evaluation failure (should retry, fallback to default score)
- [ ] Test code execution timeout (should return error, not hang)
- [ ] Test invalid question data (missing rubric, invalid test cases)
- [ ] Test user navigating away during interview (should save progress)

---

## 9. Documentation

### 9.1 Technical Documentation
- [ ] Update CLAUDE.md with Phase 2 architecture and patterns
- [ ] Document interview service API endpoints
- [ ] Document AI evaluation prompt templates
- [ ] Document code execution setup (Judge0 configuration)
- [ ] Document scoring algorithm and weighting

### 9.2 User Documentation
- [ ] Candidate guide: How to take interviews
- [ ] Candidate guide: Understanding your interview results
- [ ] Employer guide: How interview scores work in matching
- [ ] FAQ: Interview retake policy, score expiry, percentiles

### 9.3 Admin Documentation
- [ ] How to create new interview templates
- [ ] How to add questions to existing templates
- [ ] Best practices for writing evaluation rubrics
- [ ] How to monitor AI evaluation quality

---

## Phase 2 Success Criteria

### Core Functionality
- [ ] 5+ skills have complete interview templates (15 questions each)
- [ ] Users can start, take, and submit interviews
- [ ] Multiple choice questions are automatically scored
- [ ] Coding questions execute and score correctly (Judge0)
- [ ] Open-ended questions are evaluated by AI (Bedrock)
- [ ] Skill scores are calculated and stored with percentiles
- [ ] Matching system uses verified interview scores
- [ ] Interview results page displays detailed feedback
- [ ] Users can retake expired interviews

### Technical Requirements
- [ ] Interview Service running on port 3005
- [ ] Bedrock API integration working (Claude 3.5 Sonnet)
- [ ] Judge0 API integration working (code execution)
- [ ] All services communicating correctly
- [ ] Database schema supports all interview features
- [ ] Interview state management (in_progress, completed, expired)
- [ ] Error handling for AI and code execution failures

### Testing Requirements
- [ ] 50+ interviews completed by test users
- [ ] AI evaluation accuracy validated (spot-check 20 evaluations)
- [ ] Coding questions execute successfully (95%+ success rate)
- [ ] Percentile calculations verified with multiple users
- [ ] End-to-end tests passing for complete interview flow
- [ ] Performance metrics within acceptable range (<30s AI evaluation, <5s code execution)

### User Experience
- [ ] Interview UI is intuitive and easy to navigate
- [ ] Code editor works smoothly (Monaco integration)
- [ ] Results page provides actionable feedback
- [ ] Interview history page displays all relevant information
- [ ] Mobile-friendly interview experience (responsive design)

### Business Logic
- [ ] One interview per user per skill (6-month validity)
- [ ] Retake policy enforced (only after expiry)
- [ ] Interview scores automatically update matching
- [ ] Employers see verified scores vs manual scores
- [ ] Percentile rankings provide competitive context

---

## Current Progress

**Status**: 🚀 Ready to Start Phase 2

**Estimated Timeline**: 7 weeks (can be adjusted based on complexity and priorities)

**Next Steps**:
1. **Update database schema** for context-aware interviews (generated_questions, candidate_context columns)
2. Set up Interview Service foundation (service structure, ProfileContextService)
3. Build AI Question Generation Service (the CORE of this system)
4. Test question generation with real candidate profiles
5. Build interview session management (start with AI generation, answer, submit)
6. Implement context-aware AI evaluation

**Dependencies**:
- AWS Bedrock access (Claude 3.5 Sonnet model) - **CRITICAL**
- Access to candidate profiles, resumes, work history (already have this from Phase 1)
- Continued use of existing backend services (Auth, Profile, Matching)
- (Optional) Judge0 API for code execution - may not be needed if AI can evaluate code quality

**Risks & Mitigations**:
- **AI question generation quality**: Mitigate with detailed guidelines, test with diverse profiles, iterate prompts
- **AI evaluation accuracy**: Mitigate with careful prompt engineering, spot-check results, include candidate context
- **Bedrock API costs**: This will be MORE expensive than static questions, but provides far superior value. Monitor costs closely, optimize prompts.
- **Profile data quality**: If candidate has sparse profile, questions may be generic. Encourage profile completion before interviews.
- **Question uniqueness**: Each interview is unique, so can't compare scores as directly. Use percentiles and holistic evaluation.

---

## Notes

## 🎯 CRITICAL PARADIGM SHIFT

**JobGraph interviews are NOT like other platforms**. Key differentiators:

1. **Voice-Based Conversational Interviews**
   - ❌ Not a static questionnaire you fill out
   - ✅ LIVE conversation with AI interviewer
   - Feels like a real phone screen with cameras off
   - AI adapts questions based on your responses in real-time

2. **No Static Question Banks**
   - ❌ Don't build a database of 1000 generic questions
   - ✅ AI conducts a ~20-30 minute conversation
   - Each candidate gets a UNIQUE interview experience
   - AI asks follow-ups based on what you say

3. **Context is Everything**
   - AI reviews your profile BEFORE the interview
   - Every question references YOUR actual work
   - "Tell me about your Flask API project" not "Explain REST APIs"
   - Evaluation considers your claimed experience level

4. **Profile Quality Matters**
   - Better profiles = better, more relevant interviews
   - Incentivize candidates to complete profiles BEFORE taking interviews
   - Consider requiring resume upload before allowing interviews
   - AI can't ask good questions without context

5. **Voice Technology Stack**
   - **TTS**: AWS Polly or ElevenLabs (AI voice)
   - **STT**: Web Speech API (browser) or Deepgram (server)
   - **AI Engine**: Bedrock Claude 3.5 Sonnet (conversation)
   - **Audio Storage**: S3 for recordings (optional)
   - **Real-time**: WebSocket for low-latency responses

6. **This is Expensive But Worth It**
   - ~$1.50-$2.50 per interview in AI costs (TTS + STT + Bedrock)
   - But candidates get a MUCH better, natural interview experience
   - Employers get MUCH better signal (can't fake a conversation)
   - **Can detect resume inflation** through follow-up questions

7. **Implementation Focus**
   - 40% on AI conversation engine (the hardest part)
   - 30% on voice integration (TTS/STT, audio handling)
   - 20% on frontend voice UI (clean, intuitive interface)
   - 10% on profile context service

8. **Why Voice vs Text?**
   - **More natural**: Feels like a real interview
   - **Harder to cheat**: Can't Google answers mid-conversation
   - **Better signal**: How you explain things verbally shows deeper understanding
   - **Faster**: Speaking is faster than typing
   - **Accessible**: Works for people who struggle with written communication
   - **Differentiator**: No other platform does this

## Additional Notes

- Phase 2 is the **core value proposition** of JobGraph (take interview once, use everywhere)
- Focus on 5 high-demand skills initially: Python, JavaScript, Machine Learning, SQL, React
- AI evaluation quality is critical - invest time in prompt engineering and testing
- Interview experience should be smooth and professional - candidates will judge the platform based on this
- The more context we have, the better the interview - encourage profile completion
- **Document every prompt used** - prompts are the core IP of this system
- Start simple, iterate based on feedback - don't over-engineer on first pass
