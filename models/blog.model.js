const mongoose = require('mongoose');

const BlogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    image: {
      url: { 
        type: String, 
        required: true 
      }, // Store the image URL
      public_id: { 
        type: String, 
        required: true 
      }, // Store the public ID for Cloudinary or any image hosting service
    },
    metaTitle: {
      type: String, 
      required: true, // SEO Meta Title
    },
    metaDescription: {
      type: String, 
      required: true, // SEO Meta Description
    },
    createdAt: {
      type: Date,       
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Blog', BlogSchema);
