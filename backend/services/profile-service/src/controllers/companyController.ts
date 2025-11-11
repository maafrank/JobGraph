import { Request, Response } from 'express';
import { query, successResponse, errorResponse } from '@jobgraph/common';

/**
 * Create a new company profile
 * Only users with employer role can create companies
 * The user is automatically added as the company owner
 */
export async function createCompany(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;
    const userRole = (req as any).user.role;

    const {
      name,
      description,
      website,
      industry,
      companySize,
      city,
      state,
      country
    } = req.body;

    // Validate required fields
    if (!name) {
      res.status(400).json(
        errorResponse('MISSING_FIELDS', 'Company name is required')
      );
      return;
    }

    // Only employers can create companies
    if (userRole !== 'employer') {
      res.status(403).json(
        errorResponse('FORBIDDEN', 'Only employers can create companies')
      );
      return;
    }

    // Check if user already owns or is part of a company
    const existingCompanyUser = await query(
      'SELECT company_id FROM company_users WHERE user_id = $1',
      [userId]
    );

    if (existingCompanyUser.rows.length > 0) {
      res.status(400).json(
        errorResponse('ALREADY_HAS_COMPANY', 'User is already associated with a company')
      );
      return;
    }

    // Check if company name already exists
    const existingCompany = await query(
      'SELECT company_id FROM companies WHERE name = $1',
      [name]
    );

    if (existingCompany.rows.length > 0) {
      res.status(400).json(
        errorResponse('COMPANY_EXISTS', 'A company with this name already exists')
      );
      return;
    }

    // Validate company size if provided
    const validSizes = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
    if (companySize && !validSizes.includes(companySize)) {
      res.status(400).json(
        errorResponse('INVALID_SIZE', `Company size must be one of: ${validSizes.join(', ')}`)
      );
      return;
    }

    // Create company
    const companyResult = await query(
      `INSERT INTO companies (
        name, description, website, industry, company_size,
        city, state, country
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [name, description, website, industry, companySize, city, state, country]
    );

    const company = companyResult.rows[0];

    // Link user to company as owner
    await query(
      `INSERT INTO company_users (user_id, company_id, role)
       VALUES ($1, $2, 'owner')`,
      [userId, company.company_id]
    );

    res.status(201).json(
      successResponse({
        companyId: company.company_id,
        name: company.name,
        description: company.description,
        website: company.website,
        industry: company.industry,
        companySize: company.company_size,
        location: {
          city: company.city,
          state: company.state,
          country: company.country,
        },
        verified: company.verified,
        createdAt: company.created_at,
      })
    );
  } catch (error: any) {
    console.error('Create company error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred creating the company')
    );
  }
}

/**
 * Get company profile by company ID
 * Public endpoint - anyone can view company profiles
 */
export async function getCompany(req: Request, res: Response): Promise<void> {
  try {
    const { companyId } = req.params;

    const result = await query(
      'SELECT * FROM companies WHERE company_id = $1',
      [companyId]
    );

    if (result.rows.length === 0) {
      res.status(404).json(
        errorResponse('COMPANY_NOT_FOUND', 'Company not found')
      );
      return;
    }

    const company = result.rows[0];

    res.status(200).json(
      successResponse({
        companyId: company.company_id,
        name: company.name,
        description: company.description,
        website: company.website,
        logoUrl: company.logo_url,
        industry: company.industry,
        companySize: company.company_size,
        location: {
          city: company.city,
          state: company.state,
          country: company.country,
        },
        verified: company.verified,
        createdAt: company.created_at,
        updatedAt: company.updated_at,
      })
    );
  } catch (error: any) {
    console.error('Get company error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred fetching the company')
    );
  }
}

/**
 * Get the authenticated user's company
 * Returns the company the user is associated with
 */
export async function getMyCompany(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;

    // Find user's company
    const result = await query(
      `SELECT c.*, cu.role as user_role
       FROM companies c
       JOIN company_users cu ON c.company_id = cu.company_id
       WHERE cu.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json(
        errorResponse('NO_COMPANY', 'User is not associated with any company')
      );
      return;
    }

    const company = result.rows[0];

    res.status(200).json(
      successResponse({
        companyId: company.company_id,
        name: company.name,
        description: company.description,
        website: company.website,
        logoUrl: company.logo_url,
        industry: company.industry,
        companySize: company.company_size,
        location: {
          city: company.city,
          state: company.state,
          country: company.country,
        },
        verified: company.verified,
        userRole: company.user_role,
        createdAt: company.created_at,
        updatedAt: company.updated_at,
      })
    );
  } catch (error: any) {
    console.error('Get my company error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred fetching your company')
    );
  }
}

/**
 * Update company profile
 * Only company owners and admins can update
 */
export async function updateCompany(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.user_id;
    const {
      name,
      description,
      website,
      industry,
      companySize,
      city,
      state,
      country
    } = req.body;

    // Find user's company and verify permissions
    const companyCheck = await query(
      `SELECT c.company_id, cu.role
       FROM companies c
       JOIN company_users cu ON c.company_id = cu.company_id
       WHERE cu.user_id = $1`,
      [userId]
    );

    if (companyCheck.rows.length === 0) {
      res.status(404).json(
        errorResponse('NO_COMPANY', 'User is not associated with any company')
      );
      return;
    }

    const { company_id: companyId, role } = companyCheck.rows[0];

    // Only owners and admins can update company profile
    if (role !== 'owner' && role !== 'admin') {
      res.status(403).json(
        errorResponse('FORBIDDEN', 'Only company owners and admins can update the profile')
      );
      return;
    }

    // If changing name, check if it's already taken by another company
    if (name) {
      const existingCompany = await query(
        'SELECT company_id FROM companies WHERE name = $1 AND company_id != $2',
        [name, companyId]
      );

      if (existingCompany.rows.length > 0) {
        res.status(400).json(
          errorResponse('NAME_EXISTS', 'A company with this name already exists')
        );
        return;
      }
    }

    // Validate company size if provided
    const validSizes = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
    if (companySize && !validSizes.includes(companySize)) {
      res.status(400).json(
        errorResponse('INVALID_SIZE', `Company size must be one of: ${validSizes.join(', ')}`)
      );
      return;
    }

    // Update company with only provided fields
    const result = await query(
      `UPDATE companies
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           website = COALESCE($3, website),
           industry = COALESCE($4, industry),
           company_size = COALESCE($5, company_size),
           city = COALESCE($6, city),
           state = COALESCE($7, state),
           country = COALESCE($8, country),
           updated_at = NOW()
       WHERE company_id = $9
       RETURNING *`,
      [name, description, website, industry, companySize, city, state, country, companyId]
    );

    const company = result.rows[0];

    res.status(200).json(
      successResponse({
        companyId: company.company_id,
        name: company.name,
        description: company.description,
        website: company.website,
        logoUrl: company.logo_url,
        industry: company.industry,
        companySize: company.company_size,
        location: {
          city: company.city,
          state: company.state,
          country: company.country,
        },
        verified: company.verified,
        updatedAt: company.updated_at,
      })
    );
  } catch (error: any) {
    console.error('Update company error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred updating the company')
    );
  }
}

/**
 * List all companies (with optional filters)
 * Public endpoint for browsing companies
 */
export async function listCompanies(req: Request, res: Response): Promise<void> {
  try {
    const {
      page = 1,
      limit = 20,
      industry,
      verified,
      search
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    // Build query with filters
    let whereConditions = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (industry) {
      whereConditions.push(`industry = $${paramIndex}`);
      params.push(industry);
      paramIndex++;
    }

    if (verified !== undefined) {
      whereConditions.push(`verified = $${paramIndex}`);
      params.push(verified === 'true');
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM companies ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    params.push(Number(limit), offset);
    const result = await query(
      `SELECT * FROM companies ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    const companies = result.rows.map(c => ({
      companyId: c.company_id,
      name: c.name,
      description: c.description,
      website: c.website,
      logoUrl: c.logo_url,
      industry: c.industry,
      companySize: c.company_size,
      location: {
        city: c.city,
        state: c.state,
        country: c.country,
      },
      verified: c.verified,
      createdAt: c.created_at,
    }));

    res.status(200).json(
      successResponse(
        { companies },
        {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        }
      )
    );
  } catch (error: any) {
    console.error('List companies error:', error);
    res.status(500).json(
      errorResponse('INTERNAL_ERROR', 'An error occurred listing companies')
    );
  }
}
