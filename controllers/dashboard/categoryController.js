const categoryModel = require('../../models/categoryModel');
const { responseReturn } = require('../../utiles/response');
const formidable = require('formidable');
const redis = require('../../utiles/Redis');
const cloudinary = require('../../utiles/cloudinary');

// Custom slug generator
const customSlugify = (text) => {
  return text
    .toString()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[।,\/#!$%\^&\*;:{}=\_`~()]/g, '')
    .replace(/-+/g, '-')
    .toLowerCase();
};

// Image validation
const validateImageFile = (image, allowedTypes = ['image/jpeg', 'image/png', 'image/webp']) => {
  if (!image) return 'ছবি দেওয়া আবশ্যক।';
  if (!allowedTypes.includes(image.mimetype)) return 'শুধুমাত্র jpeg, png, এবং webp ছবি গ্রহণযোগ্য।';
  return null;
};

// ✅ Cache Clear Function
const clearAllCategoryCache = async () => {
  try {
    const keys = await redis.keys('category:all*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Cache clearing error:', error.message);
  }
};

// ✅ Add Category
const add_category = async (req, res) => {
  const form = formidable({ multiples: false, maxFileSize: 2 * 1024 * 1024, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return responseReturn(res, 400, { error: 'অনুরোধটি প্রক্রিয়া করা যায়নি।' });

    try {
      let { name } = fields;
      const { image } = files;

      if (!name || name.trim() === '') return responseReturn(res, 400, { error: 'ক্যাটেগরির নাম আবশ্যক।' });
      name = name.trim();

      const slug = customSlugify(name);
      if (!slug) return responseReturn(res, 400, { error: 'স্লাগ তৈরি করতে সমস্যা হয়েছে।' });

      const existingCategory = await categoryModel.findOne({ slug });
      if (existingCategory) return responseReturn(res, 400, { error: 'এই ক্যাটেগরি আগেই আছে।' });

      const imageError = validateImageFile(image);
      if (imageError) return responseReturn(res, 400, { error: imageError });

      const result = await cloudinary.uploader.upload(image.filepath, {
        folder: 'categories',
        transformation: [{ width: 500, height: 500, crop: 'limit' }, { quality: 'auto', fetch_format: 'webp' }],
        format: 'webp',
      });

      const category = await categoryModel.create({
        name,
        slug,
        image: { url: result.secure_url, public_id: result.public_id },
      });

      await clearAllCategoryCache();

      return responseReturn(res, 201, { category, message: 'ক্যাটেগরি সফলভাবে যোগ হয়েছে।' });

    } catch (error) {
      console.error('Add category error:', error.message);
      return responseReturn(res, 500, { error: 'সার্ভারে সমস্যা হয়েছে।' });
    }
  });
};

// ✅ Get All Categories (no pagination)
const get_all_categories = async (req, res) => {
  try {
    const cacheKey = 'category:all:full';
    const cachedData = await redis.get(cacheKey);
    if (cachedData) return responseReturn(res, 200, JSON.parse(cachedData));

    const categorys = await categoryModel.find().sort({ _id: 1 });
    await redis.set(cacheKey, JSON.stringify(categorys), 'EX', 600);
    return responseReturn(res, 200, categorys);

  } catch (error) {
    console.error('Get all categories error:', error.message);
    return responseReturn(res, 500, { error: 'সার্ভারে সমস্যা হয়েছে।' });
  }
};

// ✅ Get Categories with pagination & caching
const get_category = async (req, res) => {
  const { page = 1, searchValue = "", parPage = 5 } = req.query;
  console.log(req.query)
  try {
    const pageNum = Number(page) || 1;
    const perPageNum = Number(parPage) || 5;
    const skipPage = perPageNum * (pageNum - 1);
    const normalizedSearch = searchValue.trim().normalize("NFC");

    const cacheKey = `category:all:${normalizedSearch}_${perPageNum}_${pageNum}`;
    const cachedCategories = await redis.get(cacheKey);
    if (cachedCategories) return responseReturn(res, 200, JSON.parse(cachedCategories));

    const query = normalizedSearch ? { name: { $regex: normalizedSearch, $options: "i" } } : {};

    const [categories, totalCategory] = await Promise.all([
      categoryModel.find(query).skip(skipPage).limit(perPageNum).sort({ _id: 1 }),
      categoryModel.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCategory / perPageNum) || 1;

    const responseData = {
      totalCategory,
      categories,
      currentPage: pageNum,
      totalPages,
    };

    await redis.set(cacheKey, JSON.stringify(responseData), 'EX', 300);
    return responseReturn(res, 200, responseData);

  } catch (error) {
    console.error('Get category error:', error.message);
    return responseReturn(res, 500, { error: 'সার্ভারে সমস্যা হয়েছে।' });
  }
};

// ✅ Edit Category
const edit_category = async (req, res) => {
  const form = formidable({ multiples: false, maxFileSize: 2 * 1024 * 1024, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return responseReturn(res, 400, { error: 'অনুরোধটি প্রক্রিয়া করা যায়নি।' });

    try {
      let { name, id } = fields;
      const { image } = files;

      if (!name || name.trim() === '') return responseReturn(res, 400, { error: 'ক্যাটেগরির নাম আবশ্যক।' });
      name = name.trim();

      const category = await categoryModel.findById(id);
      if (!category) return responseReturn(res, 404, { error: 'ক্যাটেগরি পাওয়া যায়নি।' });

      const slug = customSlugify(name);

      if (slug !== category.slug) {
        const existingSlug = await categoryModel.findOne({ slug, _id: { $ne: id } });
        if (existingSlug) return responseReturn(res, 400, { error: 'এই নাম আগে থেকেই আছে।' });
      }

      let imageData = category.image;

      if (image) {
        const imageError = validateImageFile(image);
        if (imageError) return responseReturn(res, 400, { error: imageError });

        await cloudinary.uploader.destroy(category.image.public_id);

        const result = await cloudinary.uploader.upload(image.filepath, {
          folder: 'categories',
          transformation: [{ width: 500, height: 500, crop: 'limit' }, { quality: 'auto', fetch_format: 'webp' }],
          format: 'webp',
        });

        imageData = { url: result.secure_url, public_id: result.public_id };
      }

      category.name = name;
      category.slug = slug;
      category.image = imageData;

      await category.save();
      await clearAllCategoryCache();

      return responseReturn(res, 200, { message: 'ক্যাটেগরি সফলভাবে আপডেট হয়েছে।' });

    } catch (error) {
      console.error('Edit category error:', error.message);
      return responseReturn(res, 500, { error: 'সার্ভারে সমস্যা হয়েছে।' });
    }
  });
};

// ✅ Delete Category
const delete_category = async (req, res) => {
  const { id } = req.params;

  try {
    const category = await categoryModel.findById(id);
    if (!category) return responseReturn(res, 404, { error: 'ক্যাটেগরি পাওয়া যায়নি।' });

    if (category.image?.public_id) {
      await cloudinary.uploader.destroy(category.image.public_id);
    }

    await categoryModel.deleteOne({ _id: id });
    await clearAllCategoryCache();

    return responseReturn(res, 200, { message: 'ক্যাটেগরি সফলভাবে ডিলিট হয়েছে।' });

  } catch (error) {
    console.error('Delete category error:', error.message);
    return responseReturn(res, 500, { error: 'সার্ভারে categories হয়েছে।' });
  }
};

module.exports = {
  get_category,
  add_category,
  edit_category,
  delete_category,
  get_all_categories
};
