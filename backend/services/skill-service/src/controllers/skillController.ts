import { Request, Response } from 'express';
import { query, successResponse, errorResponse } from '@jobgraph/common';

/**
 * Get all skills with pagination, filtering, and search
 * Query params:
 *   - page: page number (default 1)
 *   - limit: items per page (default 20)
 *   - category: filter by category
 *   - search: search by name (case-insensitive)
 *   - active: filter by active status (default true)
 */
export async function getSkills(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const category = req.query.category as string;
    const search = req.query.search as string;
    const active = req.query.active !== 'false'; // Default true

    // Build query dynamically
    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (active !== undefined) {
      whereConditions.push(`active = $${paramIndex++}`);
      queryParams.push(active);
    }

    if (category) {
      whereConditions.push(`category = $${paramIndex++}`);
      queryParams.push(category);
    }

    if (search) {
      whereConditions.push(`name ILIKE $${paramIndex++}`);
      queryParams.push(`%${search}%`);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM skills ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const result = await query(
      `SELECT skill_id, name, category, description, active, created_at
       FROM skills
       ${whereClause}
       ORDER BY category, name
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    res.status(200).json(successResponse(
      result.rows.map(skill => ({
        skill_id: skill.skill_id,
        skill_name: skill.name,
        category: skill.category,
        description: skill.description,
        active: skill.active,
        created_at: skill.created_at,
      })),
      {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      }
    ));
  } catch (error: any) {
    console.error('Error fetching skills:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to fetch skills'));
  }
}

/**
 * Get skill by ID
 */
export async function getSkillById(req: Request, res: Response): Promise<void> {
  try {
    const { skillId } = req.params;

    const result = await query(
      'SELECT skill_id, name, category, description, active, created_at FROM skills WHERE skill_id = $1',
      [skillId]
    );

    if (result.rows.length === 0) {
      res.status(404).json(errorResponse('SKILL_NOT_FOUND', 'Skill not found'));
      return;
    }

    const skill = result.rows[0];

    res.status(200).json(successResponse({
      skillId: skill.skill_id,
      name: skill.name,
      category: skill.category,
      description: skill.description,
      active: skill.active,
      createdAt: skill.created_at,
    }));
  } catch (error: any) {
    console.error('Error fetching skill:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to fetch skill'));
  }
}

/**
 * Get categories (distinct list)
 */
export async function getCategories(req: Request, res: Response): Promise<void> {
  try {
    const result = await query(
      'SELECT DISTINCT category FROM skills WHERE active = TRUE ORDER BY category',
      []
    );

    res.status(200).json(successResponse(
      result.rows.map(row => row.category)
    ));
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to fetch categories'));
  }
}
