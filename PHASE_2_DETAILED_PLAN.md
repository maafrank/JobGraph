# Phase 2: Interview System - Detailed Implementation Plan

**Timeline**: Week 12-18 (7 weeks)
**Goal**: Complete skill-based interview system with AI scoring and real matching

---

## Week 12: Interview Templates & Questions (2.1)

### Day 1-2: Admin Interface for Interview Management

**Create Interview Admin Service** (`backend/services/interview-service/src/services/admin.service.ts`):
```typescript
import { pool } from '@jobgraph/common/database';
import { AppError } from '@jobgraph/common/utils';

export class InterviewAdminService {
  async createTemplate(data: any) {
    const { skillId, name, description, difficultyLevel, durationMinutes } = data;

    const result = await pool.query(
      `INSERT INTO interview_templates (skill_id, name, description, difficulty_level, duration_minutes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [skillId, name, description, difficultyLevel, durationMinutes]
    );

    return result.rows[0];
  }

  async addQuestion(data: any) {
    const {
      templateId,
      questionText,
      questionType,
      difficulty,
      points,
      options, // JSON for MCQ
      correctAnswer,
      evaluationRubric,
      testCases, // JSON for coding
      timeLimitSeconds,
    } = data;

    const result = await pool.query(
      `INSERT INTO questions (
        template_id, question_text, question_type, difficulty, points,
        options, correct_answer, evaluation_rubric, test_cases, time_limit_seconds
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        templateId,
        questionText,
        questionType,
        difficulty,
        points,
        options ? JSON.stringify(options) : null,
        correctAnswer,
        evaluationRubric,
        testCases ? JSON.stringify(testCases) : null,
        timeLimitSeconds,
      ]
    );

    return result.rows[0];
  }

  async getTemplate(templateId: string) {
    const result = await pool.query(
      `SELECT t.*,
              s.name as skill_name,
              (SELECT json_agg(q.*) FROM questions q WHERE q.template_id = t.template_id) as questions
       FROM interview_templates t
       JOIN skills s ON t.skill_id = s.skill_id
       WHERE t.template_id = $1`,
      [templateId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');
    }

    return result.rows[0];
  }

  async listTemplatesBySkill(skillId: string) {
    const result = await pool.query(
      `SELECT t.*, COUNT(q.question_id) as question_count
       FROM interview_templates t
       LEFT JOIN questions q ON t.template_id = q.template_id
       WHERE t.skill_id = $1 AND t.active = true
       GROUP BY t.template_id
       ORDER BY t.difficulty_level`,
      [skillId]
    );

    return result.rows;
  }
}
```

### Day 3-5: Seed Interview Questions

**Create Seed Script** (`scripts/seed-data/seed-interview-templates.ts`):
```typescript
import { pool } from '../../backend/common/src/database';

// Python Interview Questions
const pythonQuestions = [
  {
    text: 'What is the difference between a list and a tuple in Python?',
    type: 'multiple_choice',
    difficulty: 'easy',
    points: 10,
    options: {
      A: 'Lists are immutable, tuples are mutable',
      B: 'Lists are mutable, tuples are immutable',
      C: 'There is no difference',
      D: 'Tuples are faster but can\'t store strings',
    },
    correctAnswer: 'B',
  },
  {
    text: 'Write a function that returns the nth Fibonacci number.',
    type: 'coding',
    difficulty: 'medium',
    points: 20,
    testCases: [
      { input: '0', expected: '0' },
      { input: '1', expected: '1' },
      { input: '5', expected: '5' },
      { input: '10', expected: '55' },
    ],
    timeLimit: 300, // 5 minutes
  },
  {
    text: 'Explain the Global Interpreter Lock (GIL) in Python and its implications for multi-threading.',
    type: 'open_ended',
    difficulty: 'hard',
    points: 15,
    rubric: `
      Good answer should include:
      - GIL is a mutex that protects access to Python objects
      - Only one thread can execute Python bytecode at a time
      - Impacts CPU-bound programs but not I/O-bound programs
      - Solutions: multiprocessing, async/await, or native extensions
    `,
  },
  // Add 10-12 more questions...
];

// Machine Learning Interview Questions
const mlQuestions = [
  {
    text: 'What is the difference between supervised and unsupervised learning?',
    type: 'open_ended',
    difficulty: 'easy',
    points: 10,
    rubric: `
      Should mention:
      - Supervised learning uses labeled data
      - Unsupervised learning finds patterns in unlabeled data
      - Examples of each (classification/regression vs clustering/dimensionality reduction)
    `,
  },
  {
    text: 'Which of the following is NOT a method to prevent overfitting?',
    type: 'multiple_choice',
    difficulty: 'medium',
    points: 10,
    options: {
      A: 'Regularization (L1/L2)',
      B: 'Dropout',
      C: 'Increasing model complexity',
      D: 'Cross-validation',
    },
    correctAnswer: 'C',
  },
  {
    text: 'Implement a function to calculate the accuracy, precision, and recall given true labels and predictions.',
    type: 'coding',
    difficulty: 'medium',
    points: 20,
    testCases: [
      {
        input: 'true=[1,1,0,0,1], pred=[1,0,0,0,1]',
        expected: 'accuracy=0.8, precision=1.0, recall=0.67',
      },
    ],
    timeLimit: 600,
  },
  // Add more questions...
];

async function seedInterviewTemplates() {
  const client = await pool.connect();

  try {
    console.log('🌱 Seeding interview templates and questions...');

    // Get skill IDs
    const skillsResult = await client.query(
      'SELECT skill_id, name FROM skills WHERE name IN ($1, $2)',
      ['Python', 'Machine Learning']
    );

    const pythonSkillId = skillsResult.rows.find(s => s.name === 'Python')?.skill_id;
    const mlSkillId = skillsResult.rows.find(s => s.name === 'Machine Learning')?.skill_id;

    // Create Python template
    const pythonTemplateResult = await client.query(
      `INSERT INTO interview_templates (skill_id, name, description, difficulty_level, duration_minutes, active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING template_id`,
      [pythonSkillId, 'Python Programming Assessment', 'Comprehensive Python skills evaluation', 'intermediate', 45]
    );

    const pythonTemplateId = pythonTemplateResult.rows[0].template_id;

    // Add Python questions
    for (const q of pythonQuestions) {
      await client.query(
        `INSERT INTO questions (
          template_id, question_text, question_type, difficulty, points,
          options, correct_answer, evaluation_rubric, test_cases, time_limit_seconds
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          pythonTemplateId,
          q.text,
          q.type,
          q.difficulty,
          q.points,
          q.options ? JSON.stringify(q.options) : null,
          q.correctAnswer || null,
          q.rubric || null,
          q.testCases ? JSON.stringify(q.testCases) : null,
          q.timeLimit || null,
        ]
      );
    }

    // Create ML template
    const mlTemplateResult = await client.query(
      `INSERT INTO interview_templates (skill_id, name, description, difficulty_level, duration_minutes, active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING template_id`,
      [mlSkillId, 'Machine Learning Assessment', 'ML concepts and implementation skills', 'intermediate', 50]
    );

    const mlTemplateId = mlTemplateResult.rows[0].template_id;

    // Add ML questions
    for (const q of mlQuestions) {
      await client.query(
        `INSERT INTO questions (
          template_id, question_text, question_type, difficulty, points,
          options, correct_answer, evaluation_rubric, test_cases, time_limit_seconds
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          mlTemplateId,
          q.text,
          q.type,
          q.difficulty,
          q.points,
          q.options ? JSON.stringify(q.options) : null,
          q.correctAnswer || null,
          q.rubric || null,
          q.testCases ? JSON.stringify(q.testCases) : null,
          q.timeLimit || null,
        ]
      );
    }

    console.log('✓ Seeded interview templates and questions');
  } catch (error) {
    console.error('Error seeding interview templates:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedInterviewTemplates();
```

---

## Week 13-14: Interview Service - Taking Interviews (2.2)

### Day 1-3: Interview Session Management

**Interview Service** (`backend/services/interview-service/src/services/interview.service.ts`):
```typescript
import { pool, transaction } from '@jobgraph/common/database';
import { AppError } from '@jobgraph/common/utils';

export class InterviewService {
  async startInterview(userId: string, skillId: string) {
    return transaction(async (client) => {
      // Check if user already has an active or completed interview for this skill
      const existingInterview = await client.query(
        `SELECT interview_id, status FROM interviews
         WHERE user_id = $1 AND skill_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [userId, skillId]
      );

      if (existingInterview.rows.length > 0) {
        const existing = existingInterview.rows[0];

        if (existing.status === 'in_progress') {
          throw new AppError(409, 'INTERVIEW_IN_PROGRESS', 'You already have an active interview for this skill');
        }

        if (existing.status === 'completed') {
          // Check if interview is still valid
          const scoreResult = await client.query(
            'SELECT expires_at FROM user_skill_scores WHERE user_id = $1 AND skill_id = $2',
            [userId, skillId]
          );

          if (scoreResult.rows.length > 0) {
            const expiresAt = new Date(scoreResult.rows[0].expires_at);
            if (expiresAt > new Date()) {
              throw new AppError(409, 'INTERVIEW_ALREADY_COMPLETED', 'You already have a valid interview score for this skill');
            }
          }
        }
      }

      // Get active template for skill
      const templateResult = await client.query(
        `SELECT template_id FROM interview_templates
         WHERE skill_id = $1 AND active = true
         ORDER BY created_at DESC LIMIT 1`,
        [skillId]
      );

      if (templateResult.rows.length === 0) {
        throw new AppError(404, 'NO_TEMPLATE_FOUND', 'No active interview template found for this skill');
      }

      const templateId = templateResult.rows[0].template_id;

      // Create interview
      const interviewResult = await client.query(
        `INSERT INTO interviews (user_id, skill_id, template_id, status, started_at)
         VALUES ($1, $2, $3, 'in_progress', NOW())
         RETURNING *`,
        [userId, skillId, templateId]
      );

      const interview = interviewResult.rows[0];

      // Get questions
      const questionsResult = await client.query(
        `SELECT question_id, question_text, question_type, difficulty, points, options, time_limit_seconds
         FROM questions
         WHERE template_id = $1
         ORDER BY difficulty, RANDOM()`,
        [templateId]
      );

      return {
        interview,
        questions: questionsResult.rows,
      };
    });
  }

  async submitAnswer(interviewId: string, userId: string, questionId: string, answer: string) {
    // Verify interview belongs to user and is in progress
    const interviewResult = await pool.query(
      'SELECT status FROM interviews WHERE interview_id = $1 AND user_id = $2',
      [interviewId, userId]
    );

    if (interviewResult.rows.length === 0) {
      throw new AppError(404, 'INTERVIEW_NOT_FOUND', 'Interview not found');
    }

    if (interviewResult.rows[0].status !== 'in_progress') {
      throw new AppError(400, 'INTERVIEW_NOT_IN_PROGRESS', 'Interview is not in progress');
    }

    // Check if answer already exists
    const existingAnswer = await pool.query(
      'SELECT response_id FROM interview_responses WHERE interview_id = $1 AND question_id = $2',
      [interviewId, questionId]
    );

    if (existingAnswer.rows.length > 0) {
      // Update existing answer
      await pool.query(
        'UPDATE interview_responses SET answer = $3, time_spent_seconds = $4 WHERE response_id = $1',
        [existingAnswer.rows[0].response_id, answer, 0] // TODO: Track time spent
      );
    } else {
      // Insert new answer
      await pool.query(
        `INSERT INTO interview_responses (interview_id, question_id, answer)
         VALUES ($1, $2, $3)`,
        [interviewId, questionId, answer]
      );
    }

    return { success: true };
  }

  async submitInterview(interviewId: string, userId: string) {
    return transaction(async (client) => {
      // Verify interview
      const interviewResult = await client.query(
        'SELECT * FROM interviews WHERE interview_id = $1 AND user_id = $2 AND status = $3',
        [interviewId, userId, 'in_progress']
      );

      if (interviewResult.rows.length === 0) {
        throw new AppError(404, 'INTERVIEW_NOT_FOUND', 'Interview not found or already completed');
      }

      const interview = interviewResult.rows[0];

      // Check if all questions are answered
      const questionsResult = await client.query(
        'SELECT COUNT(*) FROM questions WHERE template_id = $1',
        [interview.template_id]
      );

      const answersResult = await client.query(
        'SELECT COUNT(*) FROM interview_responses WHERE interview_id = $1',
        [interviewId]
      );

      const totalQuestions = parseInt(questionsResult.rows[0].count);
      const answeredQuestions = parseInt(answersResult.rows[0].count);

      if (answeredQuestions < totalQuestions) {
        throw new AppError(400, 'INCOMPLETE_INTERVIEW', `Please answer all questions (${answeredQuestions}/${totalQuestions} answered)`);
      }

      // Update interview status
      await client.query(
        `UPDATE interviews
         SET status = 'completed', completed_at = NOW()
         WHERE interview_id = $1`,
        [interviewId]
      );

      // Trigger scoring (async process)
      // This would be handled by a Lambda function or background job
      // For now, we'll return and handle scoring separately

      return {
        message: 'Interview submitted successfully. Scoring in progress...',
        interviewId,
      };
    });
  }

  async getInterview(interviewId: string, userId: string) {
    const result = await pool.query(
      `SELECT i.*,
              s.name as skill_name,
              (SELECT json_agg(
                json_build_object(
                  'question_id', q.question_id,
                  'question_text', q.question_text,
                  'question_type', q.question_type,
                  'options', q.options,
                  'answer', ir.answer,
                  'score', ir.score
                )
              ) FROM questions q
              LEFT JOIN interview_responses ir ON q.question_id = ir.question_id AND ir.interview_id = i.interview_id
              WHERE q.template_id = i.template_id) as questions
       FROM interviews i
       JOIN skills s ON i.skill_id = s.skill_id
       WHERE i.interview_id = $1 AND i.user_id = $2`,
      [interviewId, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'INTERVIEW_NOT_FOUND', 'Interview not found');
    }

    return result.rows[0];
  }

  async getInterviewResults(interviewId: string, userId: string) {
    const result = await pool.query(
      `SELECT i.*,
              s.name as skill_name,
              ie.strengths,
              ie.weaknesses,
              ie.confidence_level,
              ie.detailed_feedback,
              (SELECT json_agg(
                json_build_object(
                  'question_text', q.question_text,
                  'question_type', q.question_type,
                  'answer', ir.answer,
                  'score', ir.score,
                  'ai_feedback', ir.ai_feedback
                )
              ) FROM questions q
              JOIN interview_responses ir ON q.question_id = ir.question_id
              WHERE ir.interview_id = i.interview_id) as responses
       FROM interviews i
       JOIN skills s ON i.skill_id = s.skill_id
       LEFT JOIN interview_evaluations ie ON i.interview_id = ie.interview_id
       WHERE i.interview_id = $1 AND i.user_id = $2 AND i.status = 'completed'`,
      [interviewId, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'RESULTS_NOT_FOUND', 'Interview results not found');
    }

    return result.rows[0];
  }

  async listUserInterviews(userId: string) {
    const result = await pool.query(
      `SELECT i.interview_id, i.skill_id, i.status, i.overall_score,
              i.started_at, i.completed_at,
              s.name as skill_name,
              uss.percentile
       FROM interviews i
       JOIN skills s ON i.skill_id = s.skill_id
       LEFT JOIN user_skill_scores uss ON i.interview_id = uss.interview_id
       WHERE i.user_id = $1
       ORDER BY i.created_at DESC`,
      [userId]
    );

    return result.rows;
  }
}
```

### Day 4-5: Frontend Interview UI

**Interview Components**:

1. **Interview Start Page** (`frontend/src/pages/interview/InterviewStart.tsx`):
   - Display skill information
   - Show estimated duration
   - Start interview button

2. **Interview Question Display** (`frontend/src/components/interview/QuestionDisplay.tsx`):
   - Multiple choice renderer
   - Code editor (Monaco Editor) for coding questions
   - Text area for open-ended questions
   - Timer display
   - Progress indicator

3. **Code Editor Integration**:
```bash
cd frontend
npm install @monaco-editor/react
```

```typescript
import Editor from '@monaco-editor/react';

function CodingQuestion({ question, onSubmit }) {
  const [code, setCode] = useState('');

  return (
    <div>
      <h3>{question.question_text}</h3>
      <Editor
        height="400px"
        defaultLanguage="python"
        value={code}
        onChange={(value) => setCode(value || '')}
        theme="vs-dark"
      />
      <button onClick={() => onSubmit(code)}>Submit Answer</button>
    </div>
  );
}
```

---

## Week 15: Automated Scoring (2.3)

### Day 1-2: Multiple Choice Scoring

**Scoring Service** (`backend/services/interview-service/src/services/scoring.service.ts`):
```typescript
export class ScoringService {
  async scoreInterview(interviewId: string) {
    return transaction(async (client) => {
      // Get all responses
      const responsesResult = await client.query(
        `SELECT ir.*, q.question_type, q.correct_answer, q.points, q.test_cases
         FROM interview_responses ir
         JOIN questions q ON ir.question_id = q.question_id
         WHERE ir.interview_id = $1`,
        [interviewId]
      );

      const responses = responsesResult.rows;
      let totalScore = 0;
      let totalPoints = 0;

      for (const response of responses) {
        let score = 0;

        switch (response.question_type) {
          case 'multiple_choice':
            score = this.scoreMultipleChoice(response);
            break;
          case 'coding':
            score = await this.scoreCodingQuestion(response);
            break;
          case 'open_ended':
            // Will be scored by AI later
            score = 0;
            break;
        }

        // Update response score
        await client.query(
          'UPDATE interview_responses SET score = $2 WHERE response_id = $1',
          [response.response_id, score]
        );

        totalScore += score;
        totalPoints += response.points;
      }

      // Calculate percentage score
      const overallScore = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;

      // Update interview
      await client.query(
        'UPDATE interviews SET overall_score = $2 WHERE interview_id = $1',
        [interviewId, overallScore]
      );

      return { overallScore, totalScore, totalPoints };
    });
  }

  private scoreMultipleChoice(response: any): number {
    const userAnswer = response.answer.trim().toUpperCase();
    const correctAnswer = response.correct_answer.trim().toUpperCase();

    return userAnswer === correctAnswer ? response.points : 0;
  }

  private async scoreCodingQuestion(response: any): Promise<number> {
    // Use Judge0 API or AWS Lambda to execute code
    const testCases = JSON.parse(response.test_cases || '[]');

    if (testCases.length === 0) {
      return 0;
    }

    let passedTests = 0;

    for (const testCase of testCases) {
      const passed = await this.executeCode(response.answer, testCase);
      if (passed) {
        passedTests++;
      }
    }

    const percentage = passedTests / testCases.length;
    return Math.round(percentage * response.points);
  }

  private async executeCode(code: string, testCase: any): Promise<boolean> {
    // TODO: Implement code execution
    // Options:
    // 1. Judge0 API (https://judge0.com/)
    // 2. AWS Lambda with sandboxing
    // 3. Docker containers

    // For now, return mock result
    return Math.random() > 0.3; // 70% pass rate for testing
  }
}
```

### Day 3-5: Coding Question Execution

**Judge0 Integration**:
```typescript
import axios from 'axios';

const JUDGE0_API_URL = 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;

export class CodeExecutionService {
  async executeCode(code: string, language: string, input: string): Promise<any> {
    try {
      // Submit code
      const submission = await axios.post(
        `${JUDGE0_API_URL}/submissions`,
        {
          source_code: Buffer.from(code).toString('base64'),
          language_id: this.getLanguageId(language),
          stdin: Buffer.from(input).toString('base64'),
        },
        {
          headers: {
            'X-RapidAPI-Key': JUDGE0_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      const token = submission.data.token;

      // Wait for result (with timeout)
      let attempts = 0;
      while (attempts < 10) {
        await this.sleep(500);

        const result = await axios.get(`${JUDGE0_API_URL}/submissions/${token}`, {
          headers: { 'X-RapidAPI-Key': JUDGE0_API_KEY },
        });

        const status = result.data.status.id;

        // 3 = Accepted
        if (status === 3) {
          return {
            success: true,
            output: Buffer.from(result.data.stdout || '', 'base64').toString(),
          };
        }

        // 4-14 = Various errors
        if (status > 3) {
          return {
            success: false,
            error: result.data.status.description,
            stderr: Buffer.from(result.data.stderr || '', 'base64').toString(),
          };
        }

        attempts++;
      }

      throw new Error('Code execution timeout');
    } catch (error) {
      console.error('Code execution error:', error);
      throw error;
    }
  }

  private getLanguageId(language: string): number {
    const languageMap: Record<string, number> = {
      python: 71, // Python 3
      javascript: 63, // Node.js
      java: 62,
      cpp: 54, // C++
      go: 60,
    };

    return languageMap[language.toLowerCase()] || 71;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

---

## Week 16: AI-Powered Scoring (2.4)

### Day 1-3: AWS Bedrock Integration

**Install AWS Bedrock SDK**:
```bash
npm install @aws-sdk/client-bedrock-runtime
```

**AI Evaluation Service** (`backend/services/interview-service/src/services/ai-evaluation.service.ts`):
```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { pool } from '@jobgraph/common/database';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export class AIEvaluationService {
  async evaluateOpenEndedQuestions(interviewId: string) {
    // Get all open-ended questions
    const responsesResult = await pool.query(
      `SELECT ir.*, q.question_text, q.evaluation_rubric, q.points
       FROM interview_responses ir
       JOIN questions q ON ir.question_id = q.question_id
       WHERE ir.interview_id = $1 AND q.question_type = 'open_ended'`,
      [interviewId]
    );

    const responses = responsesResult.rows;

    for (const response of responses) {
      const evaluation = await this.evaluateResponse(
        response.question_text,
        response.evaluation_rubric,
        response.answer
      );

      // Update response with AI evaluation
      await pool.query(
        `UPDATE interview_responses
         SET score = $2, ai_feedback = $3
         WHERE response_id = $1`,
        [response.response_id, evaluation.score, evaluation.feedback]
      );
    }

    // Recalculate overall score
    await this.recalculateOverallScore(interviewId);

    // Generate overall evaluation
    await this.generateOverallEvaluation(interviewId);
  }

  private async evaluateResponse(question: string, rubric: string, answer: string) {
    const prompt = `You are an expert technical interviewer. Evaluate the following interview response.

Question: ${question}

Evaluation Rubric:
${rubric}

Candidate's Answer:
${answer}

Provide your evaluation in the following JSON format:
{
  "score": <number between 0-100>,
  "reasoning": "<brief explanation of the score>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<area for improvement 1>", "<area for improvement 2>"],
  "confidence": <number between 0-1>
}

Be fair but rigorous in your evaluation. Consider completeness, accuracy, and clarity of the answer.`;

    try {
      const command = new InvokeModelCommand({
        modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Parse the JSON from Claude's response
      const contentText = responseBody.content[0].text;

      // Extract JSON from the response (Claude might wrap it in markdown)
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse evaluation JSON');
      }

      const evaluation = JSON.parse(jsonMatch[0]);

      return {
        score: evaluation.score,
        feedback: JSON.stringify({
          reasoning: evaluation.reasoning,
          strengths: evaluation.strengths,
          improvements: evaluation.improvements,
        }),
        confidence: evaluation.confidence,
      };
    } catch (error) {
      console.error('AI evaluation error:', error);

      // Fallback to a default score
      return {
        score: 50,
        feedback: JSON.stringify({
          reasoning: 'Automated evaluation unavailable',
          strengths: [],
          improvements: [],
        }),
        confidence: 0.5,
      };
    }
  }

  private async recalculateOverallScore(interviewId: string) {
    const result = await pool.query(
      `SELECT SUM(ir.score) as total_score, SUM(q.points) as total_points
       FROM interview_responses ir
       JOIN questions q ON ir.question_id = q.question_id
       WHERE ir.interview_id = $1`,
      [interviewId]
    );

    const { total_score, total_points } = result.rows[0];
    const overallScore = total_points > 0 ? (total_score / total_points) * 100 : 0;

    await pool.query(
      'UPDATE interviews SET overall_score = $2 WHERE interview_id = $1',
      [interviewId, overallScore]
    );
  }

  private async generateOverallEvaluation(interviewId: string) {
    // Get all responses with feedback
    const responsesResult = await pool.query(
      `SELECT ir.score, ir.ai_feedback, q.question_text
       FROM interview_responses ir
       JOIN questions q ON ir.question_id = q.question_id
       WHERE ir.interview_id = $1`,
      [interviewId]
    );

    const responses = responsesResult.rows;

    // Aggregate strengths and weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    for (const response of responses) {
      if (response.ai_feedback) {
        const feedback = JSON.parse(response.ai_feedback);
        strengths.push(...(feedback.strengths || []));
        weaknesses.push(...(feedback.improvements || []));
      }
    }

    // Get overall score
    const interviewResult = await pool.query(
      'SELECT overall_score FROM interviews WHERE interview_id = $1',
      [interviewId]
    );

    const overallScore = interviewResult.rows[0].overall_score;

    // Store evaluation
    await pool.query(
      `INSERT INTO interview_evaluations (interview_id, strengths, weaknesses, confidence_level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (interview_id) DO UPDATE
       SET strengths = $2, weaknesses = $3, confidence_level = $4`,
      [interviewId, strengths.slice(0, 5), weaknesses.slice(0, 5), 0.8]
    );
  }
}
```

### Day 4-5: Testing AI Evaluation

**Test with Sample Answers**:
```typescript
describe('AI Evaluation', () => {
  it('should evaluate good answer highly', async () => {
    const goodAnswer = `
      The GIL (Global Interpreter Lock) is a mutex that prevents multiple native threads
      from executing Python bytecodes simultaneously. This means only one thread can execute
      Python code at a time, even on multi-core processors.

      This impacts CPU-bound programs significantly as they cannot utilize multiple cores
      effectively. However, I/O-bound programs are less affected since the GIL is released
      during I/O operations.

      Solutions include using multiprocessing instead of multithreading for CPU-bound tasks,
      async/await for I/O-bound tasks, or writing CPU-intensive parts in C extensions.
    `;

    const evaluation = await aiService.evaluateResponse(
      'Explain the GIL in Python',
      'Should mention GIL definition, impact on threading, and solutions',
      goodAnswer
    );

    expect(evaluation.score).toBeGreaterThan(75);
  });

  it('should evaluate poor answer lowly', async () => {
    const poorAnswer = 'The GIL is something in Python about threads.';

    const evaluation = await aiService.evaluateResponse(
      'Explain the GIL in Python',
      'Should mention GIL definition, impact on threading, and solutions',
      poorAnswer
    );

    expect(evaluation.score).toBeLessThan(40);
  });
});
```

---

## Week 17: Interview Results & Skill Scores (2.5)

### Day 1-2: Skill Score Calculation

**Skill Score Service**:
```typescript
export class SkillScoreService {
  async calculateSkillScore(interviewId: string) {
    const interviewResult = await pool.query(
      `SELECT i.*, u.user_id
       FROM interviews i
       JOIN users u ON i.user_id = u.user_id
       WHERE i.interview_id = $1 AND i.status = 'completed'`,
      [interviewId]
    );

    if (interviewResult.rows.length === 0) {
      throw new AppError(404, 'INTERVIEW_NOT_FOUND', 'Interview not found');
    }

    const interview = interviewResult.rows[0];

    // Calculate percentile
    const percentile = await this.calculatePercentile(
      interview.skill_id,
      interview.overall_score
    );

    // Set expiry (6 months from now)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 6);

    // Upsert user skill score
    await pool.query(
      `INSERT INTO user_skill_scores (user_id, skill_id, interview_id, score, percentile, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, skill_id)
       DO UPDATE SET
         interview_id = $3,
         score = $4,
         percentile = $5,
         created_at = CURRENT_TIMESTAMP,
         expires_at = $6`,
      [interview.user_id, interview.skill_id, interviewId, interview.overall_score, percentile, expiresAt]
    );

    // Set interview valid_until
    await pool.query(
      'UPDATE interviews SET valid_until = $2 WHERE interview_id = $1',
      [interviewId, expiresAt]
    );

    return {
      score: interview.overall_score,
      percentile,
      expiresAt,
    };
  }

  private async calculatePercentile(skillId: string, score: number): Promise<number> {
    // Count how many users have lower scores
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM user_skill_scores
       WHERE skill_id = $1 AND score < $2 AND expires_at > NOW()`,
      [skillId, score]
    );

    const lowerScores = parseInt(result.rows[0].count);

    // Count total users with this skill
    const totalResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM user_skill_scores
       WHERE skill_id = $1 AND expires_at > NOW()`,
      [skillId]
    );

    const totalUsers = parseInt(totalResult.rows[0].count);

    if (totalUsers === 0) {
      return 50; // Default percentile if no other users
    }

    return Math.round((lowerScores / totalUsers) * 100);
  }
}
```

### Day 3-4: Trigger Matching

**After skill score is calculated, trigger job matching**:
```typescript
import { publishEvent } from '@jobgraph/common/events';

// After calculating skill score
await skillScoreService.calculateSkillScore(interviewId);

// Publish event to trigger matching
await publishEvent('skill_score_updated', {
  userId: interview.user_id,
  skillId: interview.skill_id,
  score: interview.overall_score,
});
```

**Matching Service Listener**:
```typescript
// Listen for skill_score_updated events
eventBus.on('skill_score_updated', async (data) => {
  const { userId, skillId } = data;

  // Find jobs that require this skill
  const jobsResult = await pool.query(
    `SELECT DISTINCT j.job_id
     FROM jobs j
     JOIN job_skills js ON j.job_id = js.job_id
     WHERE js.skill_id = $1 AND j.status = 'active'`,
    [skillId]
  );

  // Recalculate matches for each job
  for (const job of jobsResult.rows) {
    await matchingService.calculateJobMatches(job.job_id);
  }

  // Notify user of new high-quality matches
  await notificationService.notifyNewMatches(userId);
});
```

### Day 5: Results Page Frontend

**Interview Results Component**:
```typescript
function InterviewResults({ interviewId }) {
  const { data, isLoading } = useQuery(['interview-results', interviewId], () =>
    api.get(`/interviews/${interviewId}/results`)
  );

  if (isLoading) return <LoadingSpinner />;

  const { overall_score, percentile, strengths, weaknesses, responses } = data;

  return (
    <div>
      <h1>Interview Results</h1>

      <div className="score-card">
        <h2>Overall Score: {overall_score.toFixed(1)}/100</h2>
        <p>You scored better than {percentile}% of all candidates</p>
      </div>

      <div className="strengths">
        <h3>Strengths</h3>
        <ul>
          {strengths.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>

      <div className="areas-for-improvement">
        <h3>Areas for Improvement</h3>
        <ul>
          {weaknesses.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      </div>

      <div className="question-breakdown">
        <h3>Question-by-Question Breakdown</h3>
        {responses.map((r, i) => (
          <div key={i} className="response-card">
            <h4>Question {i + 1}</h4>
            <p>{r.question_text}</p>
            <p>Your answer: {r.answer}</p>
            <p>Score: {r.score}</p>
            {r.ai_feedback && (
              <div className="feedback">
                <p>{JSON.parse(r.ai_feedback).reasoning}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Week 18: Advanced Matching (2.6)

### Day 1-3: Replace Manual Scores

**Update Matching Algorithm**:
- Only consider candidates who have completed interviews for required skills
- Use `user_skill_scores` table instead of manual entry
- Check `expires_at` to ensure scores are still valid

### Day 4-5: Scheduled Matching & Notifications

**Create Lambda Function** (or cron job):
```typescript
// Lambda handler for scheduled matching
export async function handler(event: any) {
  // Get all active jobs
  const jobsResult = await pool.query(
    'SELECT job_id FROM jobs WHERE status = $1',
    ['active']
  );

  // Recalculate matches for each job
  for (const job of jobsResult.rows) {
    await matchingService.calculateJobMatches(job.job_id);
  }

  console.log(`Recalculated matches for ${jobsResult.rows.length} jobs`);
}
```

**EventBridge Rule** (in infrastructure):
```typescript
// Run daily at 2 AM
const rule = new events.Rule(this, 'DailyMatchingRule', {
  schedule: events.Schedule.cron({ hour: '2', minute: '0' }),
});

rule.addTarget(new targets.LambdaFunction(matchingLambda));
```

---

## Phase 2 Deliverables Checklist

- [ ] Interview templates and question bank for 10+ skills
- [ ] Interview session management (start, answer, submit)
- [ ] Multiple choice auto-scoring
- [ ] Coding question execution (Judge0 or Lambda)
- [ ] AI evaluation of open-ended questions (Bedrock)
- [ ] Skill score calculation with percentiles
- [ ] Interview results page with detailed feedback
- [ ] Automated matching triggered by new skill scores
- [ ] Scheduled daily matching job
- [ ] Frontend interview UI (question display, code editor, timer)
- [ ] Integration tests for complete interview flow

**Success Criteria**:
- 50+ interviews completed
- AI evaluation working with 80%+ accuracy
- Coding questions execute successfully
- Matching uses real interview scores
- Users receive notifications for new matches
- Interview results provide actionable feedback

**Ready for Phase 3: Enhancement & Polish**
