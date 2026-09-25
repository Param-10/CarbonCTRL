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
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
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
  // Secrets are excluded from queries by default; load them with .select('+field')
  twoFactorSecret: {
    type: String,
    select: false
  },
  // Holds the secret between 2FA setup and verification, before 2FA is enabled
  twoFactorTempSecret: {
    type: String,
    select: false
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
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

// Transform toJSON to remove sensitive data
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  // Lets the client know whether a current password is required (Google-only users have none)
  user.hasPassword = Boolean(this.password);
  delete user.password;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;
  delete user.emailVerificationToken;
  delete user.twoFactorSecret;
  delete user.twoFactorTempSecret;
  return user;
};

export default mongoose.model('User', userSchema); 