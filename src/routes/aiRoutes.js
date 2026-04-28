import { Router } from 'express';
import {
  chatWithAI,
  getBookRecommendations,
  smartBookSearch,
  getReadingInsights,
  generateBookSummary,
} from '../controllers/aiControllers.js';
import verifyToken from '../middleware/verifyToken.js';

const router = Router();

// All AI endpoints are protected (only logged-in users can access)
router.use(verifyToken);

// Chat endpoints
router.post('/chat', chatWithAI);
router.post('/recommendations', getBookRecommendations);
router.post('/smart-search', smartBookSearch);
router.get('/insights/:userId', getReadingInsights);
router.get('/summary/:bookId', generateBookSummary);

export default router;