const formidable = require('formidable');
const { responseReturn } = require('../../utiles/response');
const cloudinary = require('../../utiles/cloudinary');
const redis = require('../../utiles/Redis');
const blogModel = require("../../models/blog.model");

// ➕ Add Blog with Redis cache invalidation
const addBlog = async (req, res) => {
  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parsing error:', err);
      return responseReturn(res, 400, { error: 'অনুরোধটি প্রক্রিয়া করা যায়নি।' });
    }

    try {
      let { title, content, metaTitle, metaDescription } = fields;
      const { image } = files;

      // Validation
      if (!title || title.trim() === '') {
        return responseReturn(res, 400, { error: 'ব্লগের টাইটেল দেওয়া আবশ্যক।' });
      }
      if (!content || content.trim() === '') {
        return responseReturn(res, 400, { error: 'ব্লগের কনটেন্ট দেওয়া আবশ্যক।' });
      }
      if (!metaTitle || metaTitle.trim() === '') {
        return responseReturn(res, 400, { error: 'মেটা টাইটেল দেওয়া আবশ্যক।' });
      }
      if (!metaDescription || metaDescription.trim() === '') {
        return responseReturn(res, 400, { error: 'মেটা ডিসক্রিপশন দেওয়া আবশ্যক।' });
      }
      if (!image) {
        return responseReturn(res, 400, { error: 'ব্লগের ছবি দেওয়া আবশ্যক।' });
      }

      // Cloudinary image upload
      const result = await cloudinary.uploader.upload(image.filepath, {
        folder: 'blogs',
        transformation: [{ width: 800, height: 400, crop: 'limit' }, { quality: 'auto' }],
        format: 'webp',
      });

      // Create blog
      const newBlog = await blogModel.create({
        title,
        content,
        metaTitle,
        metaDescription,
        image: {
          url: result.secure_url,
          public_id: result.public_id,
        },
      });

      // Clear all blogs cache (invalidate)
      await redis.del('allBlogsCache');

      return responseReturn(res, 201, {
        blog: newBlog,
        message: 'ব্লগ সফলভাবে যুক্ত হয়েছে।',
      });

    } catch (error) {
      console.error('Add Blog API Error:', error);
      return responseReturn(res, 500, { error: 'সার্ভারে কিছু সমস্যা হয়েছে।' });
    }
  });
};

// 📜 Get Blogs with pagination, search and caching
const get_blogs = async (req, res) => {
  let { page = 1, parPage = 0, searchValue = "" } = req.query;
  page = parseInt(page);
  parPage = parseInt(parPage);
  const skip = parPage ? parPage * (page - 1) : 0;

  // Cache key with pagination & search for uniqueness
  const cacheKey = `allBlogsCache:page${page}:limit${parPage}:search:${searchValue}`;

  try {
    const cachedBlogs = await redis.get(cacheKey);
    if (cachedBlogs) {
      return responseReturn(res, 200, JSON.parse(cachedBlogs));
    }

    let query = {};
    if (searchValue) {
      query = { $text: { $search: searchValue } };
    }

    const [blogs, totalBlog] = await Promise.all([
      blogModel.find(query, { title: 1, createdAt: 1, image: 1, metaTitle: 1, content: 1 })
        .skip(skip)
        .limit(parPage || 0)
        .sort({ createdAt: -1 }),
      blogModel.countDocuments(query),
    ]);

    const responseData = { totalBlog, blogs };

    // Cache with expiry 5 mins
    await redis.setex(cacheKey, 300, JSON.stringify(responseData));

    return responseReturn(res, 200, responseData);

  } catch (error) {
    console.error('Get blogs API error:', error);
    return responseReturn(res, 500, { error: 'সার্ভারে সমস্যা হয়েছে।' });
  }
};

// 🗑 Delete Blog with cache invalidation
const delete_blog = async (req, res) => {
  const { id } = req.params;

  try {
    const findBlog = await blogModel.findById(id);
    if (!findBlog) {
      return responseReturn(res, 404, { error: "ব্লগ পাওয়া যায়নি।" });
    }

    // Remove image from Cloudinary
    await cloudinary.uploader.destroy(findBlog.image.public_id);

    // Delete blog
    await blogModel.findByIdAndDelete(id);

    // Invalidate all blogs cache and single blog cache
    await Promise.all([
      redis.del('allBlogsCache'),
      redis.del(`blog:${id}`),
    ]);

    return responseReturn(res, 200, { message: "ব্লগ সফলভাবে ডিলিট হয়েছে।" });

  } catch (error) {
    console.error(error.message);
    return responseReturn(res, 500, { error: "সার্ভার সমস্যার কারণে ডিলিট করা যায়নি।" });
  }
};

// 📄 Get Single Blog with caching
const blog_get = async (req, res) => {
  const { blogId } = req.params;
  const cacheKey = `blog:${blogId}`;

  try {
    const cachedBlog = await redis.get(cacheKey);
    if (cachedBlog) {
      return responseReturn(res, 200, { blog: JSON.parse(cachedBlog) });
    }

    const blog = await blogModel.findById(blogId);
    if (!blog) {
      return responseReturn(res, 404, { error: "দুঃখিত, এই ব্লগটি খুঁজে পাওয়া যায়নি।" });
    }

    await redis.setex(cacheKey, 3600, JSON.stringify(blog)); // ১ ঘণ্টা ক্যাশ

    return responseReturn(res, 200, { blog });

  } catch (error) {
    console.error("blog_get error:", error.message);
    return responseReturn(res, 500, { error: "সার্ভারে সমস্যা হয়েছে। পরে চেষ্টা করুন।" });
  }
};

// ✏️ Update Blog with slug generation and cache clearing
const blog_update = async (req, res) => {
  let {
    title,
    description,
    content,
    metaTitle,
    metaDescription,
    blogId,
  } = req.body;

  title = title?.trim() || "";
  // স্লাগ তৈরির জন্য অপ্রয়োজনীয় ক্যারেক্টার বাদ
  const slug = title.replace(/[^a-zA-Z0-9\s-]/g, "").split(" ").join("-");

  try {
    await blogModel.findByIdAndUpdate(blogId, {
      title,
      description,
      content,
      metaTitle,
      metaDescription,
      slug,
    });

    const updatedBlog = await blogModel.findById(blogId);
    if (!updatedBlog) {
      return responseReturn(res, 404, { error: "ব্লগ পাওয়া যায়নি।" });
    }

    await Promise.all([
      redis.del(`blog:${blogId}`),
      redis.del('allBlogsCache'),
    ]);

    return responseReturn(res, 200, {
      blog: updatedBlog,
      message: "ব্লগ সফলভাবে আপডেট হয়েছে।",
    });

  } catch (error) {
    console.error("blog_update error:", error.message);
    return responseReturn(res, 500, { error: "সার্ভারে সমস্যা হয়েছে।" });
  }
};

// 🖼 Update Blog Image with cache clearing
const blog_image_update = async (req, res) => {
  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return responseReturn(res, 400, { error: 'অনুরোধটি প্রক্রিয়া করা যায়নি।' });
    }

    const { blogId } = fields;
    const { newImage } = files;

    if (!newImage) {
      return responseReturn(res, 400, { error: 'ছবি প্রয়োজন।' });
    }

    try {
      const blog = await blogModel.findById(blogId);
      if (!blog) {
        return responseReturn(res, 404, { error: 'ব্লগ পাওয়া যায়নি।' });
      }

      // Delete old image from Cloudinary
      await cloudinary.uploader.destroy(blog.image.public_id);

      // Upload new image
      const result = await cloudinary.uploader.upload(newImage.filepath, {
        folder: 'blogs',
        transformation: [{ width: 800, height: 400, crop: 'limit' }, { quality: 'auto' }],
        format: 'webp',
      });

      blog.image = { url: result.secure_url, public_id: result.public_id };
      await blog.save();

      await Promise.all([
        redis.del(`blog:${blogId}`),
        redis.del('allBlogsCache'),
      ]);

      const updatedBlog = await blogModel.findById(blogId);
      return responseReturn(res, 200, {
        blog: updatedBlog,
        message: 'ছবি সফলভাবে আপডেট হয়েছে।',
      });
    } catch (error) {
      console.error('blog_image_update error:', error);
      return responseReturn(res, 500, { error: 'ছবি আপডেটে সমস্যা হয়েছে।' });
    }
  });
};

module.exports = {
  addBlog,
  get_blogs,
  delete_blog,
  blog_get,
  blog_image_update,
  blog_update,
};
