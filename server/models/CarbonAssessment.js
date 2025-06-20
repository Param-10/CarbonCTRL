import mongoose from 'mongoose';

const carbonAssessmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  totalEmissions: {
    type: Number,
    default: 0
  },
  grade: {
    type: String,
    default: 'N/A'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
carbonAssessmentSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('CarbonAssessment', carbonAssessmentSchema); 