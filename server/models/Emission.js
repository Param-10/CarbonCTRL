import mongoose from 'mongoose';

const emissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
emissionSchema.index({ userId: 1, type: 1 });

export default mongoose.model('Emission', emissionSchema); 