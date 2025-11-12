import mammoth from 'mammoth';
import { query } from '@jobgraph/common';
import Anthropic from '@anthropic-ai/sdk';

// pdf-parse 1.x uses simple function API
const pdfParse = require('pdf-parse');

// Lazy-initialize Anthropic client (to ensure env vars are loaded first)
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    console.log('[ResumeParser] Anthropic client initialized');
  }
  return anthropicClient;
}

interface ParsedContact {
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface ParsedSkill {
  skill_name: string;
  proficiency?: string;
  years_experience?: number;
  confidence: number;
}

interface ParsedEducation {
  degree: string;
  field_of_study?: string;
  institution: string;
  graduation_year?: number;
  gpa?: number;
  confidence: number;
}

interface ParsedWorkExperience {
  title: string;
  company: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  description?: string;
  skills_used?: string[];
  confidence: number;
}

interface ParsedCertification {
  name: string;
  issuer?: string;
  date_obtained?: string;
  expiration_date?: string;
  credential_id?: string;
  confidence: number;
}

interface ParsedResumeData {
  contact_info: ParsedContact;
  summary?: string;
  skills: ParsedSkill[];
  education: ParsedEducation[];
  work_experience: ParsedWorkExperience[];
  certifications: ParsedCertification[];
  raw_text: string;
  parser_used: string;
  confidence_score: number;
  parsing_errors: any[];
}

/**
 * Main resume parsing orchestrator
 * Fetches document, extracts text, parses data, stores results
 */
export async function parseResume(documentId: string): Promise<void> {
  try {
    // 1. Update status to processing
    await query(
      `UPDATE user_documents SET upload_status = 'processing' WHERE document_id = $1`,
      [documentId]
    );

    // 2. Fetch document from database
    const docResult = await query(
      `SELECT document_id, user_id, file_name, mime_type, file_data
       FROM user_documents
       WHERE document_id = $1`,
      [documentId]
    );

    if (docResult.rows.length === 0) {
      throw new Error('Document not found');
    }

    const doc = docResult.rows[0];

    // 3. Extract raw text based on file type
    let rawText: string;
    let parserUsed: string;

    if (doc.mime_type === 'application/pdf') {
      rawText = await extractTextFromPDF(doc.file_data);
      parserUsed = 'pdf-parse';
    } else if (doc.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      rawText = await extractTextFromDOCX(doc.file_data);
      parserUsed = 'mammoth';
    } else if (doc.mime_type === 'text/plain') {
      rawText = doc.file_data.toString('utf-8');
      parserUsed = 'text';
    } else {
      throw new Error(`Unsupported file type: ${doc.mime_type}`);
    }

    console.log(`[ResumeParser] Extracted ${rawText.length} characters from ${doc.file_name}`);

    // 4. Use Claude to extract structured data
    console.log(`[ResumeParser] Using Claude Haiku 4.5 for intelligent parsing...`);
    const parsedData = await parseResumeWithClaude(rawText, parserUsed);

    // 5. Store parsed data
    await storeParsedData(doc.document_id, doc.user_id, parsedData);

    // 6. Auto-apply parsed data to profile
    await autoApplyParsedData(doc.user_id, parsedData);

    // 7. Update document status to completed
    await query(
      `UPDATE user_documents
       SET upload_status = 'completed', processed_at = NOW()
       WHERE document_id = $1`,
      [documentId]
    );

    console.log(`[ResumeParser] Successfully parsed resume for document ${documentId}`);

  } catch (error: any) {
    console.error(`[ResumeParser] Error parsing resume ${documentId}:`, error);

    // Update status to failed with error message
    await query(
      `UPDATE user_documents
       SET upload_status = 'failed', processing_error = $1
       WHERE document_id = $2`,
      [error.message, documentId]
    );

    throw error;
  }
}

/**
 * Extract text from PDF using pdf-parse library (v1.x simple function API)
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // pdf-parse 1.x is a simple async function
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('[ResumeParser] PDF parsing error:', error);
    throw new Error('Failed to parse PDF file');
  }
}

/**
 * Extract text from DOCX using mammoth library
 */
async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('[ResumeParser] DOCX parsing error:', error);
    throw new Error('Failed to parse DOCX file');
  }
}

/**
 * Use Claude AI to intelligently parse resume text into structured data
 */
async function parseResumeWithClaude(resumeText: string, parserUsed: string): Promise<ParsedResumeData> {
  try {
    const prompt = `You are an expert resume parser. Extract structured information from the following resume text and return ONLY valid JSON (no markdown, no explanations).

Resume Text:
${resumeText}

Return a JSON object with this EXACT structure:
{
  "contact_info": {
    "email": "string or null",
    "phone": "string or null",
    "linkedin": "string or null",
    "github": "string or null",
    "website": "string or null",
    "city": "string or null",
    "state": "string or null",
    "country": "string or null"
  },
  "summary": "professional summary text or null",
  "skills": [
    {
      "skill_name": "string",
      "proficiency": "beginner|intermediate|advanced|expert or null",
      "years_experience": number or null,
      "confidence": 0.8
    }
  ],
  "education": [
    {
      "degree": "string",
      "field_of_study": "string or null",
      "institution": "string",
      "graduation_year": number or null,
      "gpa": number or null,
      "confidence": 0.9
    }
  ],
  "work_experience": [
    {
      "title": "string",
      "company": "string",
      "start_date": "YYYY-MM-DD or YYYY-MM or YYYY or null",
      "end_date": "YYYY-MM-DD or YYYY-MM or YYYY or null",
      "is_current": boolean,
      "description": "string or null",
      "skills_used": ["skill1", "skill2"] or null,
      "confidence": 0.85
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string or null",
      "date_obtained": "YYYY-MM-DD or YYYY-MM or YYYY or null",
      "expiration_date": "YYYY-MM-DD or YYYY-MM or YYYY or null",
      "credential_id": "string or null",
      "confidence": 0.8
    }
  ]
}

Important parsing rules:
1. Extract location carefully - separate city, state, and country. Do NOT mix them with other data.
2. For dates, use ISO format when possible (YYYY-MM-DD). If only year/month, use YYYY-MM or YYYY.
3. Set is_current to true for current jobs (look for "Present", "Current", or no end date with recent start date).
4. Skills should be specific technologies, tools, or programming languages - not soft skills.
5. Confidence scores should be 0.7-0.95 based on how clearly the information was stated in the resume.
6. For the summary field:
   - If the resume has an explicit summary/objective section, extract it as-is
   - If NO summary section exists, generate a concise professional summary (2-3 sentences) based on:
     * Their most recent/relevant job title and experience
     * Key areas of expertise from their work history
     * Their educational background if relevant
   - The generated summary should be professional, third-person, and highlight their core value proposition
7. Return null for location fields if not found, but ALWAYS provide a summary (extracted or generated).
8. MUST return valid JSON - no markdown code blocks, no explanations, just the JSON object.

Return the JSON now:`;

    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    // Extract JSON from response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    let jsonText = content.text.trim();

    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    console.log('[ResumeParser] Claude response length:', jsonText.length);

    // Parse the JSON response
    const claudeData = JSON.parse(jsonText);

    // Create ParsedResumeData object
    const parsedData: ParsedResumeData = {
      contact_info: claudeData.contact_info || {},
      summary: claudeData.summary || undefined,
      skills: Array.isArray(claudeData.skills) ? claudeData.skills : [],
      education: Array.isArray(claudeData.education) ? claudeData.education : [],
      work_experience: Array.isArray(claudeData.work_experience) ? claudeData.work_experience : [],
      certifications: Array.isArray(claudeData.certifications) ? claudeData.certifications : [],
      raw_text: resumeText,
      parser_used: `${parserUsed} + Claude Haiku 4.5`,
      confidence_score: 0.9, // Claude provides high accuracy
      parsing_errors: []
    };

    console.log('[ResumeParser] Successfully parsed with Claude:');
    console.log(`  - Contact info: ${Object.keys(parsedData.contact_info).length} fields`);
    console.log(`  - Skills: ${parsedData.skills.length}`);
    console.log(`  - Education: ${parsedData.education.length}`);
    console.log(`  - Work experience: ${parsedData.work_experience.length}`);
    console.log(`  - Certifications: ${parsedData.certifications.length}`);

    return parsedData;

  } catch (error: any) {
    console.error('[ResumeParser] Claude parsing error:', error);
    throw new Error(`Claude parsing failed: ${error.message}`);
  }
}

/**
 * Extract contact information using regex patterns
 */
function extractContactInfo(text: string): ParsedContact {
  const contact: ParsedContact = {};

  // Email pattern
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  if (emailMatch) {
    contact.email = emailMatch[0];
  }

  // Phone pattern (various formats)
  const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) {
    contact.phone = phoneMatch[0];
  }

  // LinkedIn pattern
  const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);
  if (linkedinMatch) {
    contact.linkedin = linkedinMatch[0];
  }

  // GitHub pattern
  const githubMatch = text.match(/github\.com\/[\w-]+/i);
  if (githubMatch) {
    contact.github = githubMatch[0];
  }

  // Website/portfolio pattern
  const websiteMatch = text.match(/(?:https?:\/\/)?(?:www\.)?[\w-]+\.[\w.-]+/);
  if (websiteMatch && !websiteMatch[0].includes('linkedin') && !websiteMatch[0].includes('github')) {
    contact.website = websiteMatch[0];
  }

  // Location pattern (City, State)
  const locationMatch = text.match(/([A-Z][a-zA-Z\s]+),\s*([A-Z]{2})/);
  if (locationMatch) {
    contact.city = locationMatch[1].trim();
    contact.state = locationMatch[2].trim();
    contact.country = 'USA'; // Default assumption, can be improved
  }

  return contact;
}

/**
 * Extract professional summary/objective
 */
function extractSummary(text: string): string | undefined {
  // Look for common summary section headers
  const summaryPatterns = [
    /(?:professional\s+)?summary[:\s]+(.+?)(?=\n\n|\n[A-Z])/si,
    /(?:professional\s+)?objective[:\s]+(.+?)(?=\n\n|\n[A-Z])/si,
    /(?:career\s+)?profile[:\s]+(.+?)(?=\n\n|\n[A-Z])/si
  ];

  for (const pattern of summaryPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim().substring(0, 500); // Limit to 500 chars
    }
  }

  return undefined;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract skills by matching against database skills
 */
async function extractSkills(text: string): Promise<ParsedSkill[]> {
  const skills: ParsedSkill[] = [];
  const lowerText = text.toLowerCase();

  try {
    // Get all active skills from database
    const skillsResult = await query(
      `SELECT skill_id, name FROM skills WHERE active = true`
    );

    // Check if each skill name appears in the resume
    for (const dbSkill of skillsResult.rows) {
      try {
        const skillName = dbSkill.name;
        // Escape special regex characters (important for skills like C++, C#, .NET)
        const escapedSkillName = escapeRegex(skillName);
        const regex = new RegExp(`\\b${escapedSkillName}\\b`, 'i');

        if (regex.test(text)) {
          skills.push({
            skill_name: skillName,
            confidence: 0.8 // High confidence for exact match
          });
        }
      } catch (skillError) {
        // Log but continue processing other skills
        console.error(`[ResumeParser] Error processing skill "${dbSkill.name}":`, skillError);
      }
    }

    console.log(`[ResumeParser] Found ${skills.length} skills in resume`);

  } catch (error) {
    console.error('[ResumeParser] Error extracting skills:', error);
  }

  return skills;
}

/**
 * Extract education using pattern matching
 */
function extractEducation(text: string): ParsedEducation[] {
  const education: ParsedEducation[] = [];

  // Common degree patterns
  const degreePatterns = [
    /\b(Bachelor|Master|PhD|Doctor|Associate|B\.S\.|M\.S\.|B\.A\.|M\.A\.|MBA)\s+(?:of\s+)?(?:Science|Arts|Engineering|Business)?\s+(?:in\s+)?([A-Za-z\s]+)/gi,
  ];

  // Common institution patterns
  const institutionPattern = /(?:University|College|Institute|School)\s+of\s+[A-Za-z\s]+/gi;

  // Year pattern
  const yearPattern = /\b(19|20)\d{2}\b/g;

  const degreeMatches = text.match(degreePatterns[0]);
  const institutionMatches = text.match(institutionPattern);
  const yearMatches = text.match(yearPattern);

  if (degreeMatches && institutionMatches) {
    // Try to pair degrees with institutions
    for (let i = 0; i < Math.min(degreeMatches.length, institutionMatches.length); i++) {
      education.push({
        degree: degreeMatches[i].trim(),
        institution: institutionMatches[i].trim(),
        graduation_year: yearMatches && yearMatches[i] ? parseInt(yearMatches[i]) : undefined,
        confidence: 0.7
      });
    }
  }

  return education;
}

/**
 * Extract work experience using pattern matching
 */
function extractWorkExperience(text: string): ParsedWorkExperience[] {
  const experiences: ParsedWorkExperience[] = [];

  // This is a simplified version - can be improved with better parsing
  // Look for patterns like "Company Name | Job Title | Dates"

  const experiencePattern = /([A-Z][A-Za-z\s&]+)\s*(?:\||–|-)\s*([A-Za-z\s]+)\s*(?:\||–|-)\s*(\d{4})\s*-\s*(\d{4}|Present|Current)/gi;

  let match;
  while ((match = experiencePattern.exec(text)) !== null) {
    experiences.push({
      company: match[1].trim(),
      title: match[2].trim(),
      start_date: match[3],
      end_date: match[4] === 'Present' || match[4] === 'Current' ? undefined : match[4],
      is_current: match[4] === 'Present' || match[4] === 'Current',
      confidence: 0.6
    });
  }

  return experiences;
}

/**
 * Extract certifications
 */
function extractCertifications(text: string): ParsedCertification[] {
  const certifications: ParsedCertification[] = [];

  // Common certification patterns
  const certPatterns = [
    /(?:AWS\s+)?Certified\s+[A-Za-z\s]+/gi,
    /(?:CompTIA|Cisco|Microsoft|Oracle)\s+[A-Za-z\s]+\s+Certification/gi,
  ];

  for (const pattern of certPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        certifications.push({
          name: match.trim(),
          confidence: 0.7
        });
      }
    }
  }

  return certifications;
}

/**
 * Store parsed data in database
 */
async function storeParsedData(
  documentId: string,
  userId: string,
  parsedData: ParsedResumeData
): Promise<void> {
  try {
    await query(
      `INSERT INTO resume_parsed_data (
        document_id, user_id, contact_info, summary, skills, education,
        work_experience, certifications, raw_text, parser_used,
        confidence_score, parsing_errors
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (document_id)
      DO UPDATE SET
        contact_info = EXCLUDED.contact_info,
        summary = EXCLUDED.summary,
        skills = EXCLUDED.skills,
        education = EXCLUDED.education,
        work_experience = EXCLUDED.work_experience,
        certifications = EXCLUDED.certifications,
        raw_text = EXCLUDED.raw_text,
        parser_used = EXCLUDED.parser_used,
        confidence_score = EXCLUDED.confidence_score,
        parsing_errors = EXCLUDED.parsing_errors,
        updated_at = NOW()`,
      [
        documentId,
        userId,
        JSON.stringify(parsedData.contact_info),
        parsedData.summary,
        JSON.stringify(parsedData.skills),
        JSON.stringify(parsedData.education),
        JSON.stringify(parsedData.work_experience),
        JSON.stringify(parsedData.certifications),
        parsedData.raw_text,
        parsedData.parser_used,
        parsedData.confidence_score,
        JSON.stringify(parsedData.parsing_errors)
      ]
    );

    console.log(`[ResumeParser] Stored parsed data for document ${documentId}`);
  } catch (error) {
    console.error('[ResumeParser] Error storing parsed data:', error);
    throw error;
  }
}

/**
 * Generate auto-fill suggestions by comparing parsed data with current profile
 */
async function generateSuggestions(
  documentId: string,
  userId: string,
  parsedData: ParsedResumeData
): Promise<void> {
  try {
    console.log(`[ResumeParser] Generating suggestions for user ${userId}`);

    // First, clear any pending suggestions for this user
    await query(
      `DELETE FROM resume_autofill_suggestions WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    );

    // Fetch current profile data
    const profileResult = await query(
      `SELECT headline, summary, city, state, country, years_experience,
              remote_preference, willing_to_relocate
       FROM candidate_profiles
       WHERE user_id = $1`,
      [userId]
    );

    const currentProfile = profileResult.rows[0] || {};

    // Generate suggestions for basic info
    await generateBasicInfoSuggestions(documentId, userId, parsedData, currentProfile);

    // Generate suggestions for education
    await generateEducationSuggestions(documentId, userId, parsedData);

    // Generate suggestions for work experience
    await generateWorkExperienceSuggestions(documentId, userId, parsedData);

    // Generate suggestions for skills
    await generateSkillsSuggestions(documentId, userId, parsedData);

    console.log(`[ResumeParser] Successfully generated suggestions for user ${userId}`);
  } catch (error) {
    console.error('[ResumeParser] Error generating suggestions:', error);
    // Don't throw - suggestions are not critical, parsing should still succeed
  }
}

/**
 * Generate basic info suggestions
 */
async function generateBasicInfoSuggestions(
  documentId: string,
  userId: string,
  parsedData: ParsedResumeData,
  currentProfile: any
): Promise<void> {
  const contactInfo = parsedData.contact_info;

  // Suggest location if we have it and profile doesn't
  if (contactInfo.city && !currentProfile.city) {
    await query(
      `INSERT INTO resume_autofill_suggestions (
        document_id, user_id, suggestion_type, suggested_data,
        target_table, confidence, status
      ) VALUES ($1, $2, 'basic_info', $3, 'candidate_profiles', $4, 'pending')`,
      [
        documentId,
        userId,
        JSON.stringify({
          field: 'location',
          city: contactInfo.city,
          state: contactInfo.state,
          country: contactInfo.country || 'USA'
        }),
        0.9
      ]
    );
  }

  // Suggest summary if we have it and profile doesn't
  if (parsedData.summary && !currentProfile.summary) {
    await query(
      `INSERT INTO resume_autofill_suggestions (
        document_id, user_id, suggestion_type, suggested_data,
        target_table, confidence, status
      ) VALUES ($1, $2, 'basic_info', $3, 'candidate_profiles', $4, 'pending')`,
      [
        documentId,
        userId,
        JSON.stringify({
          field: 'summary',
          value: parsedData.summary
        }),
        0.7
      ]
    );
  }

  console.log(`[ResumeParser] Generated basic info suggestions`);
}

/**
 * Generate education suggestions
 */
async function generateEducationSuggestions(
  documentId: string,
  userId: string,
  parsedData: ParsedResumeData
): Promise<void> {
  // Get profile_id for this user
  const profileResult = await query(
    `SELECT profile_id FROM candidate_profiles WHERE user_id = $1`,
    [userId]
  );

  if (profileResult.rows.length === 0) {
    console.log('[ResumeParser] No profile found for user');
    return;
  }

  const profileId = profileResult.rows[0].profile_id;

  // Fetch existing education records
  const existingResult = await query(
    `SELECT degree, institution FROM education WHERE profile_id = $1`,
    [profileId]
  );

  const existingEducation = existingResult.rows;

  // Check each parsed education entry
  for (const edu of parsedData.education) {
    // Check if this education already exists
    const exists = existingEducation.some(
      (existing: any) =>
        existing.degree.toLowerCase().includes(edu.degree.toLowerCase()) ||
        existing.institution.toLowerCase().includes(edu.institution.toLowerCase())
    );

    if (!exists) {
      // Create suggestion to add this education
      await query(
        `INSERT INTO resume_autofill_suggestions (
          document_id, user_id, suggestion_type, suggested_data,
          target_table, confidence, status
        ) VALUES ($1, $2, 'education', $3, 'education', $4, 'pending')`,
        [documentId, userId, JSON.stringify(edu), edu.confidence]
      );
    }
  }

  console.log(`[ResumeParser] Generated education suggestions`);
}

/**
 * Generate work experience suggestions
 */
async function generateWorkExperienceSuggestions(
  documentId: string,
  userId: string,
  parsedData: ParsedResumeData
): Promise<void> {
  // Get profile_id for this user
  const profileResult = await query(
    `SELECT profile_id FROM candidate_profiles WHERE user_id = $1`,
    [userId]
  );

  if (profileResult.rows.length === 0) {
    console.log('[ResumeParser] No profile found for user');
    return;
  }

  const profileId = profileResult.rows[0].profile_id;

  // Fetch existing work experience records
  const existingResult = await query(
    `SELECT title, company FROM work_experience WHERE profile_id = $1`,
    [profileId]
  );

  const existingExperience = existingResult.rows;

  // Check each parsed work experience entry
  for (const work of parsedData.work_experience) {
    // Check if this work experience already exists
    const exists = existingExperience.some(
      (existing: any) =>
        existing.title.toLowerCase().includes(work.title.toLowerCase()) &&
        existing.company.toLowerCase().includes(work.company.toLowerCase())
    );

    if (!exists) {
      // Create suggestion to add this work experience
      await query(
        `INSERT INTO resume_autofill_suggestions (
          document_id, user_id, suggestion_type, suggested_data,
          target_table, confidence, status
        ) VALUES ($1, $2, 'work_experience', $3, 'work_experience', $4, 'pending')`,
        [documentId, userId, JSON.stringify(work), work.confidence]
      );
    }
  }

  console.log(`[ResumeParser] Generated work experience suggestions`);
}

/**
 * Generate skills suggestions
 */
async function generateSkillsSuggestions(
  documentId: string,
  userId: string,
  parsedData: ParsedResumeData
): Promise<void> {
  // Fetch existing skills for this user
  const existingResult = await query(
    `SELECT s.name
     FROM user_skill_scores uss
     JOIN skills s ON uss.skill_id = s.skill_id
     WHERE uss.user_id = $1`,
    [userId]
  );

  const existingSkills = new Set(existingResult.rows.map((row: any) => row.name.toLowerCase()));

  // Check each parsed skill
  for (const skill of parsedData.skills) {
    if (!existingSkills.has(skill.skill_name.toLowerCase())) {
      // Create suggestion to add this skill
      await query(
        `INSERT INTO resume_autofill_suggestions (
          document_id, user_id, suggestion_type, suggested_data,
          target_table, confidence, status
        ) VALUES ($1, $2, 'skills', $3, 'user_skill_scores', $4, 'pending')`,
        [documentId, userId, JSON.stringify(skill), skill.confidence]
      );
    }
  }

  console.log(`[ResumeParser] Generated skills suggestions`);
}

/**
 * Normalize date strings to PostgreSQL DATE format
 * Handles: "YYYY-MM-DD", "YYYY-MM", "YYYY", null
 * Returns: "YYYY-MM-DD" or null
 */
function normalizeDateForPostgres(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // YYYY-MM format - add first day of month
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    return `${dateStr}-01`;
  }

  // YYYY format - add January 1st
  if (/^\d{4}$/.test(dateStr)) {
    return `${dateStr}-01-01`;
  }

  console.warn(`[ResumeParser] Invalid date format: ${dateStr}, returning null`);
  return null;
}

/**
 * Auto-apply all parsed resume data to the candidate profile
 */
async function autoApplyParsedData(
  userId: string,
  parsedData: ParsedResumeData
): Promise<void> {
  console.log(`[ResumeParser] Auto-applying parsed data for user ${userId}`);

  try {
    // Get profile_id for this user
    const profileResult = await query(
      `SELECT profile_id FROM candidate_profiles WHERE user_id = $1`,
      [userId]
    );

    if (profileResult.rows.length === 0) {
      console.log('[ResumeParser] No profile found for user, skipping auto-apply');
      return;
    }

    const profileId = profileResult.rows[0].profile_id;
    const contactInfo = parsedData.contact_info;

    // 1. Update basic profile info (only if not already set)

    // Calculate years of experience from work history
    let yearsOfExperience = 0;
    if (parsedData.work_experience && parsedData.work_experience.length > 0) {
      for (const work of parsedData.work_experience) {
        if (work.start_date) {
          const startYear = parseInt(work.start_date.substring(0, 4));
          const endYear = work.end_date ? parseInt(work.end_date.substring(0, 4)) : new Date().getFullYear();
          yearsOfExperience += (endYear - startYear);
        }
      }
    }

    // Generate a headline from the most recent job title or summary
    let headline = '';
    if (parsedData.work_experience && parsedData.work_experience.length > 0) {
      const mostRecentJob = parsedData.work_experience[0];
      headline = mostRecentJob.title || '';
    } else if (parsedData.summary) {
      // Extract first sentence or first 50 characters of summary
      headline = parsedData.summary.split('.')[0].substring(0, 100);
    }

    // Update all basic info fields (NULLIF treats empty strings as NULL)
    await query(
      `UPDATE candidate_profiles
       SET city = COALESCE(NULLIF(city, ''), $1),
           state = COALESCE(NULLIF(state, ''), $2),
           country = COALESCE(NULLIF(country, ''), $3),
           summary = COALESCE(NULLIF(summary, ''), $4),
           headline = COALESCE(NULLIF(headline, ''), $5),
           years_experience = COALESCE(NULLIF(years_experience, 0), $6),
           updated_at = NOW()
       WHERE user_id = $7`,
      [
        contactInfo.city,
        contactInfo.state,
        contactInfo.country,
        parsedData.summary,
        headline || null,
        yearsOfExperience > 0 ? yearsOfExperience : null,
        userId
      ]
    );
    console.log('[ResumeParser] Updated basic profile info (location, summary, headline, years_experience)');

    // 2. Add education entries (check for duplicates)
    const existingEducation = await query(
      `SELECT degree, institution FROM education WHERE profile_id = $1`,
      [profileId]
    );

    for (const edu of parsedData.education) {
      const exists = existingEducation.rows.some(
        (existing: any) =>
          existing.degree.toLowerCase().includes(edu.degree.toLowerCase()) ||
          existing.institution.toLowerCase().includes(edu.institution.toLowerCase())
      );

      if (!exists) {
        await query(
          `INSERT INTO education (
            profile_id, degree, field_of_study, institution, graduation_year, gpa
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            profileId,
            edu.degree,
            edu.field_of_study || null,
            edu.institution,
            edu.graduation_year || null,
            edu.gpa || null
          ]
        );
        console.log(`[ResumeParser] Added education: ${edu.degree} at ${edu.institution}`);
      }
    }

    // 3. Add work experience entries (check for duplicates)
    const existingWork = await query(
      `SELECT title, company FROM work_experience WHERE profile_id = $1`,
      [profileId]
    );

    for (const work of parsedData.work_experience) {
      const exists = existingWork.rows.some(
        (existing: any) =>
          existing.title.toLowerCase().includes(work.title.toLowerCase()) &&
          existing.company.toLowerCase().includes(work.company.toLowerCase())
      );

      if (!exists) {
        await query(
          `INSERT INTO work_experience (
            profile_id, title, company, start_date, end_date, is_current, description
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            profileId,
            work.title,
            work.company,
            normalizeDateForPostgres(work.start_date),
            normalizeDateForPostgres(work.end_date),
            work.is_current || false,
            work.description || null
          ]
        );
        console.log(`[ResumeParser] Added work experience: ${work.title} at ${work.company}`);
      }
    }

    // 4. Add skills (check for duplicates and valid skill names)
    for (const skillData of parsedData.skills) {
      // Find skill_id by name
      const skillResult = await query(
        `SELECT skill_id FROM skills WHERE name = $1 AND active = true`,
        [skillData.skill_name]
      );

      if (skillResult.rows.length > 0) {
        const skillId = skillResult.rows[0].skill_id;

        // Add to user_skill_scores with a default score of 60 (intermediate)
        await query(
          `INSERT INTO user_skill_scores (
            user_id, skill_id, score, interview_id, expires_at
          ) VALUES ($1, $2, $3, NULL, NOW() + INTERVAL '1 year')
          ON CONFLICT (user_id, skill_id) DO NOTHING`,
          [userId, skillId, 60] // Default score for resume-detected skills
        );
        console.log(`[ResumeParser] Added skill: ${skillData.skill_name}`);
      }
    }

    console.log(`[ResumeParser] Successfully auto-applied parsed data for user ${userId}`);

  } catch (error: any) {
    console.error('[ResumeParser] Error auto-applying parsed data:', error);
    // Don't throw - we don't want to fail the entire resume upload if auto-apply fails
  }
}
