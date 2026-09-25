import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password not required for Google OAuth users
    },
    minlength: 6
  },
  name: {
    type: String,
    trim: true,
    maxlength: 100
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  emailVerificationToken: String,
  lastLogin: Date,
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  // Embedded in session tokens; incrementing it signs out every existing session
  tokenVersion: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Only these fields are sent to clients. An allowlist (rather than deleting known secrets)
// keeps fields left in older documents, e.g. the removed 2FA secrets, from ever leaking.
userSchema.methods.toJSON = function() {
  const stored = this.toObject();
  // Documents created before the single name field stored firstName/lastName
  const legacyName = [stored.firstName, stored.lastName].filter(Boolean).join(' ');

  return {
    _id: stored._id,
    email: stored.email,
    name: stored.name || legacyName || undefined,
    isEmailVerified: stored.isEmailVerified,
    // Lets the client know whether a current password is required (Google-only users have none)
    hasPassword: Boolean(stored.password),
    lastLogin: stored.lastLogin,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt
  };
};

export default mongoose.model('User', userSchema); 