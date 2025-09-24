const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Recipe title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Recipe description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  ingredients: [{
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: String,
      required: true
    },
    unit: {
      type: String,
      required: true
    }
  }],
  instructions: [{
    stepNumber: {
      type: Number,
      required: true
    },
    instruction: {
      type: String,
      required: true
    }
  }],
  cookingTime: {
    prep: {
      type: Number,
      required: [true, 'Preparation time is required'],
      min: [1, 'Preparation time must be at least 1 minute']
    },
    cook: {
      type: Number,
      required: [true, 'Cooking time is required'],
      min: [1, 'Cooking time must be at least 1 minute']
    }
  },
  servings: {
    type: Number,
    required: [true, 'Number of servings is required'],
    min: [1, 'Must serve at least 1 person']
  },
  difficulty: {
    type: String,
    required: [true, 'Difficulty level is required'],
    enum: ['Easy', 'Medium', 'Hard']
  },
  cuisine: {
    type: String,
    required: [true, 'Cuisine type is required'],
    trim: true,
    maxlength: [50, 'Cuisine cannot exceed 50 characters']
  },
  dietType: {
    type: String,
    required: [true, 'Diet type is required'],
    enum: ['Vegetarian', 'Vegan', 'Gluten-Free', 'Keto', 'Paleo', 'Low-Carb', 'High-Protein', 'Regular']
  },
  calories: {
    type: Number,
    min: [1, 'Calories must be positive']
  },
  image: {
    type: String,
    required: [true, 'Recipe image is required']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ratings: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: [200, 'Comment cannot exceed 200 characters']
    }
  }],
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  nutritionalInfo: {
    protein: Number,
    carbs: Number,
    fat: Number,
    fiber: Number,
    sugar: Number
  }
}, {
  timestamps: true
});

// Calculate average rating when ratings are added
recipeSchema.methods.calculateAverageRating = function() {
  if (this.ratings.length === 0) {
    this.averageRating = 0;
    this.totalRatings = 0;
  } else {
    const total = this.ratings.reduce((sum, rating) => sum + rating.rating, 0);
    this.averageRating = Math.round((total / this.ratings.length) * 10) / 10;
    this.totalRatings = this.ratings.length;
  }
};

// Pre-save middleware to calculate rating
recipeSchema.pre('save', function(next) {
  this.calculateAverageRating();
  next();
});

// Virtual for total time
recipeSchema.virtual('totalTime').get(function() {
  return this.cookingTime.prep + this.cookingTime.cook;
});

// Ensure virtual fields are serialized
recipeSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

// Index for search functionality
recipeSchema.index({ title: 'text', description: 'text', 'ingredients.name': 'text' });
recipeSchema.index({ cuisine: 1, dietType: 1, difficulty: 1 });
recipeSchema.index({ averageRating: -1 });
recipeSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Recipe', recipeSchema);