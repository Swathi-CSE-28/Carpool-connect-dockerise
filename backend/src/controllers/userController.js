const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');

const getProfile = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeObject() });
});

const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = ['name', 'phone', 'gender', 'preferences', 'avatarColor', 'vehicle'];
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true
  });

  res.json({ success: true, user: user.toSafeObject() });
});

module.exports = { getProfile, updateProfile };
