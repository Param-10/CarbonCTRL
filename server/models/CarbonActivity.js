import mongoose from 'mongoose';

const carbonActivitySchema = new mongoose.Schema({
  assessmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CarbonAssessment',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sector: {
    type: String,
    required: true,
    trim: true
  },
  subsector: {
    type: String,
    required: true,
    trim: true
  },
  activityAmount: {
    type: Number,
    required: true,
    min: 0
  },
  activityUnit: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
carbonActivitySchema.index({ assessmentId: 1 });
carbonActivitySchema.index({ userId: 1 });

export default mongoose.model('CarbonActivity', carbonActivitySchema); 