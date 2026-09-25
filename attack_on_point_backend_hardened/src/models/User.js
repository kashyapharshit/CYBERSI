const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // password kabhi query me by default nahi aayega
    },
    role: {
      type: String,
      enum: ['admin', 'analyst', 'viewer'],
      default: 'viewer',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);