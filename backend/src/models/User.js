const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Not required for OAuth accounts: Google sign-in never sets a local password.
    password: {
      type: String,
      minlength: 6,
      select: false,
      required: function passwordRequired() { return this.authProvider === 'local'; }
    },
    role: { type: String, enum: ['passenger', 'driver', 'admin'], default: 'passenger' },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String, unique: true, sparse: true },
    // Bumped to invalidate every access token this user holds (logout-everywhere, account takeover recovery).
    tokenVersion: { type: Number, default: 0 },
    preferredLanguage: { type: String, enum: ['en', 'ta'], default: 'en' },
    // Personal API access token for the /api/public/* integration endpoints.
    apiKey: { type: String, unique: true, sparse: true, select: false },
    // Capped, most-recent-first list backing the "Recently Accessed Rides" feature.
    recentlyViewedRides: [
      {
        ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
        viewedAt: { type: Date, default: Date.now }
      }
    ],
    gender: { type: String, enum: ['female', 'male', 'other', 'prefer_not_to_say'], default: 'prefer_not_to_say' },
    phone: { type: String, trim: true },
    avatarColor: { type: String, default: '#7c3aed' },
    // Shown to passengers with a confirmed booking on the live tracking page.
    vehicle: {
      make: { type: String, trim: true, maxlength: 40 },
      model: { type: String, trim: true, maxlength: 40 },
      color: { type: String, trim: true, maxlength: 30 },
      plateNumber: { type: String, trim: true, uppercase: true, maxlength: 20 }
    },
    isVerified: { type: Boolean, default: false }, // profile verification indicator only, NOT identity verification
    preferences: {
      music: { type: Boolean, default: true },
      smoking: { type: Boolean, default: false },
      pets: { type: Boolean, default: false },
      luggage: { type: Boolean, default: true },
      conversation: { type: String, enum: ['chatty', 'quiet', 'no_preference'], default: 'no_preference' }
    },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    completedRides: { type: Number, default: 0 },
    cancelledRides: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password') || !this.password) return next(); // nothing to hash (unchanged, or cleared for OAuth-only accounts)
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password || typeof candidate !== 'string') return Promise.resolve(false); // Google-only accounts have no password
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.apiKey;
  delete obj.tokenVersion;
  return obj;
};

// Moves a ride to the front of the "recently viewed" list (deduping) and caps it at 10.
userSchema.methods.recordRideView = async function recordRideView(rideId) {
  const id = String(rideId);
  this.recentlyViewedRides = (this.recentlyViewedRides || []).filter((entry) => String(entry.ride) !== id);
  this.recentlyViewedRides.unshift({ ride: rideId, viewedAt: new Date() });
  this.recentlyViewedRides = this.recentlyViewedRides.slice(0, 10);
  await this.save({ validateBeforeSave: false });
};

module.exports = mongoose.model('User', userSchema);
