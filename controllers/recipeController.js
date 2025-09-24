const mongoose = require('mongoose');
const Recipe = require('../models/Recipe');
const User = require('../models/User');

// Create a new recipe
const createRecipe = async (req, res) => {
  try {
    const {
      title,
      description,
      ingredients,
      instructions,
      cookingTime,
      servings,
      difficulty,
      cuisine,
      dietType,
      calories,
      tags,
      nutritionalInfo
    } = req.body;

    // Parse ingredients and instructions if they're strings
    const parsedIngredients = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients;
    const parsedInstructions = typeof instructions === 'string' ? JSON.parse(instructions) : instructions;
    const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    const parsedNutritionalInfo = typeof nutritionalInfo === 'string' ? JSON.parse(nutritionalInfo) : nutritionalInfo;
    const parsedCookingTime = typeof cookingTime === 'string' ? JSON.parse(cookingTime) : cookingTime;

    const recipe = new Recipe({
      title,
      description,
      ingredients: parsedIngredients,
      instructions: parsedInstructions,
      cookingTime: parsedCookingTime,
      servings,
      difficulty,
      cuisine,
      dietType,
      calories,
      image: req.file ? `/uploads/${req.file.filename}` : '',
      author: req.user._id,
      tags: parsedTags || [],
      nutritionalInfo: parsedNutritionalInfo || {}
    });

    await recipe.save();
    await recipe.populate('author', 'username firstName lastName profileImage');

    res.status(201).json({
      success: true,
      message: 'Recipe created successfully',
      data: { recipe }
    });
  } catch (error) {
    console.error('Create recipe error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating recipe',
      error: error.message
    });
  }
};

// Get all recipes with pagination and filtering
const getRecipes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      cuisine,
      dietType,
      difficulty,
      minRating,
      maxCalories,
      maxTime,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { isPublic: true };

    if (cuisine && cuisine !== 'All') filter.cuisine = cuisine;
    if (dietType && dietType !== 'All') filter.dietType = dietType;
    if (difficulty && difficulty !== 'All') filter.difficulty = difficulty;
    if (minRating) filter.averageRating = { $gte: parseFloat(minRating) };
    if (maxCalories) filter.calories = { $lte: parseInt(maxCalories) };
    if (maxTime) {
      filter.$expr = {
        $lte: [{ $add: ['$cookingTime.prep', '$cookingTime.cook'] }, parseInt(maxTime)]
      };
    }

    // Add search functionality
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'ingredients.name': { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [recipes, total] = await Promise.all([
      Recipe.find(filter)
        .populate('author', 'username firstName lastName profileImage')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Recipe.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        recipes,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRecipes: total,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get recipes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting recipes',
      error: error.message
    });
  }
};

// Get popular recipes
const getPopularRecipes = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const recipes = await Recipe.find({ isPublic: true })
      .populate('author', 'username firstName lastName profileImage')
      .sort({ averageRating: -1, totalRatings: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: { recipes }
    });
  } catch (error) {
    console.error('Get popular recipes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting popular recipes',
      error: error.message
    });
  }
};

// Get recipe by ID
const getRecipeById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid recipe ID format'
      });
    }

    const recipe = await Recipe.findById(id)
      .populate('author', 'username firstName lastName profileImage bio')
      .populate('ratings.user', 'username firstName lastName profileImage');

    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found'
      });
    }

    res.json({
      success: true,
      data: { recipe }
    });
  } catch (error) {
    console.error('Get recipe by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting recipe',
      error: error.message
    });
  }
};

// Update recipe
const updateRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found'
      });
    }

    // Check if user is the author
    if (recipe.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this recipe'
      });
    }

    const updates = { ...req.body };

    // Parse JSON strings if necessary
    if (updates.ingredients && typeof updates.ingredients === 'string') {
      updates.ingredients = JSON.parse(updates.ingredients);
    }
    if (updates.instructions && typeof updates.instructions === 'string') {
      updates.instructions = JSON.parse(updates.instructions);
    }
    if (updates.tags && typeof updates.tags === 'string') {
      updates.tags = JSON.parse(updates.tags);
    }
    if (updates.nutritionalInfo && typeof updates.nutritionalInfo === 'string') {
      updates.nutritionalInfo = JSON.parse(updates.nutritionalInfo);
    }
    if (updates.cookingTime && typeof updates.cookingTime === 'string') {
      updates.cookingTime = JSON.parse(updates.cookingTime);
    }

    // Update image if new file uploaded
    if (req.file) {
      updates.image = `/uploads/${req.file.filename}`;
    }

    const updatedRecipe = await Recipe.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('author', 'username firstName lastName profileImage');

    res.json({
      success: true,
      message: 'Recipe updated successfully',
      data: { recipe: updatedRecipe }
    });
  } catch (error) {
    console.error('Update recipe error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating recipe',
      error: error.message
    });
  }
};

// Delete recipe
const deleteRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found'
      });
    }

    // Check if user is the author
    if (recipe.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this recipe'
      });
    }

    await Recipe.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Recipe deleted successfully'
    });
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting recipe',
      error: error.message
    });
  }
};

// Rate recipe
const rateRecipe = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found'
      });
    }

    // Check if user already rated this recipe
    const existingRatingIndex = recipe.ratings.findIndex(
      r => r.user.toString() === req.user._id.toString()
    );

    if (existingRatingIndex > -1) {
      // Update existing rating
      recipe.ratings[existingRatingIndex] = {
        user: req.user._id,
        rating: parseInt(rating),
        comment: comment || ''
      };
    } else {
      // Add new rating
      recipe.ratings.push({
        user: req.user._id,
        rating: parseInt(rating),
        comment: comment || ''
      });
    }

    await recipe.save();
    await recipe.populate('ratings.user', 'username firstName lastName profileImage');

    res.json({
      success: true,
      message: 'Recipe rated successfully',
      data: { recipe }
    });
  } catch (error) {
    console.error('Rate recipe error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error rating recipe',
      error: error.message
    });
  }
};

// Get user's recipes
const getUserRecipes = async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;

    const [recipes, total] = await Promise.all([
      Recipe.find({ author: req.user._id })
        .populate('author', 'username firstName lastName profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Recipe.countDocuments({ author: req.user._id })
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        recipes,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRecipes: total,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get user recipes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting user recipes',
      error: error.message
    });
  }
};

// Add recipe to favorites
const addToFavorites = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found'
      });
    }

    const user = await User.findById(req.user._id);
    
    if (user.favoriteRecipes.includes(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Recipe already in favorites'
      });
    }

    user.favoriteRecipes.push(req.params.id);
    await user.save();

    res.json({
      success: true,
      message: 'Recipe added to favorites'
    });
  } catch (error) {
    console.error('Add to favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding to favorites',
      error: error.message
    });
  }
};

// Remove recipe from favorites
const removeFromFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    user.favoriteRecipes = user.favoriteRecipes.filter(
      id => id.toString() !== req.params.id
    );
    
    await user.save();

    res.json({
      success: true,
      message: 'Recipe removed from favorites'
    });
  } catch (error) {
    console.error('Remove from favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error removing from favorites',
      error: error.message
    });
  }
};

// Get user's favorite recipes
const getFavoriteRecipes = async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.user._id)
      .populate({
        path: 'favoriteRecipes',
        populate: {
          path: 'author',
          select: 'username firstName lastName profileImage'
        },
        options: {
          skip: skip,
          limit: parseInt(limit),
          sort: { createdAt: -1 }
        }
      });

    const total = user.favoriteRecipes.length;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        recipes: user.favoriteRecipes,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRecipes: total,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get favorite recipes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting favorite recipes',
      error: error.message
    });
  }
};

module.exports = {
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
};