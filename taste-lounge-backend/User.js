// models/User.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Name is required'],
      trim:     true,
      maxlength:[80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    phone: {
      type:  String,
      trim:  true,
      default: '',
    },
    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select:    false,   // never returned in queries by default
    },
    role: {
      type:    String,
      enum:    ['customer', 'admin'],
      default: 'customer',
    },
    address: {
      type:    String,
      default: '',
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,   // adds createdAt & updatedAt automatically
  }
);

/* ── Hash password before saving ── */
userSchema.pre('save', async function (next) {
  // Only hash if the password field was actually modified
  if (!this.isModified('password')) return next();
  const salt    = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/* ── Instance method: check a plain password against the hash ── */
userSchema.methods.matchPassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

/* ── Virtual: never expose the password in JSON responses ── */
userSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
