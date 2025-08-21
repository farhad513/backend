const { Schema, model } = require('mongoose');

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'ক্যাটেগরির নাম দেওয়া আবশ্যক।'],
      trim: true,
      minlength: [2, 'ক্যাটেগরির নাম কমপক্ষে ২ অক্ষরের হতে হবে।'],
      maxlength: [100, 'ক্যাটেগরির নাম ১০০ অক্ষরের বেশি হতে পারবে না।']
    },
    image: {
      url: {
        type: String,
        required: [true, 'ছবির লিংক আবশ্যক।'],
        trim: true
      },
      public_id: {
        type: String,
        required: [true, 'Cloudinary public_id আবশ্যক।'],
        trim: true
      }
    },
    slug: {
      type: String,
      required: [true, 'স্লাগ আবশ্যক।'],
      trim: true,
      unique: true, // স্লাগ যেন ইউনিক হয়
      match: [/^[^\s]+$/, 'স্লাগে কোনো স্পেস থাকা যাবে না।'] // স্পেস থাকলে error
    }
  },
  { timestamps: true }
);

// ক্যাটেগরি নামে টেক্সট সার্চ ইন্ডেক্স
categorySchema.index({ name: 'text' });


module.exports = model('Category', categorySchema);
