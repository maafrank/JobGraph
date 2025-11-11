import { Router } from 'express';
import { getSkills, getSkillById, getCategories } from '../controllers/skillController';

const router = Router();

// Public routes - no authentication required
router.get('/', getSkills);
router.get('/categories', getCategories);
router.get('/:skillId', getSkillById);

export default router;
