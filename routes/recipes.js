const express = require('express');
const {
  createRecipe,
  getRecipes,
  getPopularRecipes,
  getRecipeById,
  updateRecipe,
  deleteRecipe,
  rateRecipe,
  getUserRecipes,
  addToFavorites,
  removeFromFavorites,
  getFavoriteRecipes
} = require('../controllers/recipeController');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// Public routes
router.get('/', getRecipes);
router.get('/popular', getPopularRecipes);

// Protected routes
router.post('/', authenticate, upload.single('image'), createRecipe);

// This should come after specific routes like /popular and before the :id route
router.get('/:id', getRecipeById);
router.put('/:id', authenticate, upload.single('image'), updateRecipe);
router.delete('/:id', authenticate, deleteRecipe);
router.post('/:id/rate', authenticate, rateRecipe);
router.get('/user/my-recipes', authenticate, getUserRecipes);
router.post('/:id/favorite', authenticate, addToFavorites);
router.delete('/:id/favorite', authenticate, removeFromFavorites);
router.get('/user/favorites', authenticate, getFavoriteRecipes);

module.exports = router;