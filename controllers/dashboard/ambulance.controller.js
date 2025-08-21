const formidable = require('formidable');
const { responseReturn } = require('../../utiles/response');
const cloudinary = require('../../utiles/cloudinary');
const redis = require('../../utiles/Redis');
const ambulanceModel = require("../../models/ambulance.model");
const userAmbulanceOrder = require('../../models/user.ambulance.order');

// ➕ Add Ambulance
const addAmbulance = async (req, res) => {
  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return responseReturn(res, 400, { error: 'Invalid request.' });

    try {
      const {
        ambulanceName, driverName, driverPhone, registrationNumber,
        type, chargePerKm, baseCharge, insuranceExpiry, joiningDate,
        nidNumber, category, oxygenSupport, emergencyPhone
      } = fields;
      const { image } = files;

      if (![
        ambulanceName, driverName, driverPhone, registrationNumber,
        type, chargePerKm, baseCharge, insuranceExpiry, joiningDate,
        nidNumber, category, oxygenSupport, emergencyPhone
      ].every(Boolean)) {
        return responseReturn(res, 400, { error: 'সব ফিল্ড পূরণ করা আবশ্যক।' });
      }
      if (!image) return responseReturn(res, 400, { error: 'ছবি আবশ্যক।' });

      const result = await cloudinary.uploader.upload(image.filepath, {
        folder: 'ambulances',
        transformation: [{ width: 800, crop: 'limit' }, { quality: 'auto' }],
        format: 'webp',
      });

      const newAmbulance = await ambulanceModel.create({
        ambulanceName, driverName, driverPhone, registrationNumber,
        type, chargePerKm, baseCharge, insuranceExpiry, joiningDate,
        nidNumber, category, oxygenSupport, emergencyPhone,
        image: { url: result.secure_url, public_id: result.public_id },
      });

      await redis.del("ambulances:all");

      return responseReturn(res, 201, {
        ambulance: newAmbulance,
        message: 'অ্যাম্বুলেন্স সফলভাবে যোগ হয়েছে।'
      });
    } catch (error) {
      console.error('addAmbulance error:', error);
      return responseReturn(res, 500, { error: 'সার্ভার সমস্যায় যোগ করা যায়নি।' });
    }
  });
};

// 📜 Get All Ambulances (Cached, with optional pagination/search)
const getAmbulances = async (req, res) => {
  let { page = 1, parPage = 0, searchValue = "" } = req.query;
  page = parseInt(page);
  parPage = parseInt(parPage);
  const skip = parPage ? parPage * (page - 1) : 0;
  const cacheKey = `ambulances:all:page${page}:limit${parPage}:search:${searchValue}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return responseReturn(res, 200, JSON.parse(cached));

    const query = searchValue
      ? { ambulanceName: { $regex: searchValue, $options: 'i' } }
      : {};

    const [ambulances, totalAmbulance] = await Promise.all([
      ambulanceModel.find(query, {
        ambulanceName:1, driverName:1, type:1, createdAt:1, image:1,
        category:1, driverPhone:1
      })
        .skip(skip)
        .limit(parPage || 0)
        .sort({ createdAt: -1 }),
      ambulanceModel.countDocuments(query)
    ]);

    const responseData = { totalAmbulance, ambulances };
    await redis.setex(cacheKey, 300, JSON.stringify(responseData));

    return responseReturn(res, 200, responseData);
  } catch (error) {
    console.error('getAmbulances error:', error);
    return responseReturn(res, 500, { error: 'লোড করতে সমস্যা হয়েছে।' });
  }
};

// 🚗 Get Single Ambulance (Cached)
const ambulance_get = async (req, res) => {
  const { ambulanceId } = req.params;
  const cacheKey = `ambulance:${ambulanceId}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return responseReturn(res, 200, { ambulance: JSON.parse(cached) });

    const ambulance = await ambulanceModel.findById(ambulanceId);
    if (!ambulance) return responseReturn(res, 404, { error: 'না পাওয়া যায়।' });

    await redis.setex(cacheKey, 3600, JSON.stringify(ambulance));
    return responseReturn(res, 200, { ambulance });
  } catch (error) {
    console.error('ambulance_get error:', error);
    return responseReturn(res, 500, { error: 'লোডে সমস্যা হয়েছে।' });
  }
};

// ✏️ Update Ambulance Details
const ambulance_update = async (req, res) => {
  const data = req.body;
  const ambulanceId = data.ambulanceId;
  try {
    const updated = await ambulanceModel.findByIdAndUpdate(ambulanceId, data, { new: true });
    if (!updated) return responseReturn(res, 404, { error: 'না পাওয়া যায়।' });

    await redis.del(`ambulance:${ambulanceId}`);
    await redis.del("ambulances:all");

    return responseReturn(res, 200, {
      ambulance: updated,
      message: 'আপডেট সফল।'
    });
  } catch (error) {
    console.error('ambulance_update error:', error);
    return responseReturn(res, 500, { error: 'আপডেটে সমস্যা হয়েছে।' });
  }
};

// 🖼️ Update Ambulance Image
const ambulance_image_update = async (req, res) => {
  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return responseReturn(res, 400, { error: 'invalid request' });

    const { ambulanceId } = fields;
    const { newImage } = files;
    if (!newImage) return responseReturn(res, 400, { error: 'ছবি দরকার।' });

    try {
      const ambulance = await ambulanceModel.findById(ambulanceId);
      if (!ambulance) return responseReturn(res, 404, { error: 'না পাওয়া যায়।' });

      await cloudinary.uploader.destroy(ambulance.image.public_id);
      const result = await cloudinary.uploader.upload(newImage.filepath, {
        folder: 'ambulances',
        transformation: [{ width: 800, crop: 'limit' }, { quality: 'auto' }],
        format: 'webp'
      });

      ambulance.image = { url: result.secure_url, public_id: result.public_id };
      await ambulance.save();

      await redis.del(`ambulance:${ambulanceId}`);
      await redis.del("ambulances:all");

      return responseReturn(res, 200, {
        ambulance,
        message: 'ছবি সফলভাবে আপডেট হয়েছে।'
      });
    } catch (error) {
      console.error('ambulance_image_update error:', error);
      return responseReturn(res, 500, { error: 'ছবি আপডেটে সমস্যা হয়েছে।' });
    }
  });
};

// 🗑️ Delete Ambulance
const deleteAmbulance = async (req, res) => {
  const { id } = req.params;
  try {
    const amb = await ambulanceModel.findById(id);
    if (!amb) return responseReturn(res, 404, { error: 'না পাওয়া যায়।' });

    await cloudinary.uploader.destroy(amb.image.public_id);
    await ambulanceModel.findByIdAndDelete(id);

    await Promise.all([
      redis.del(`ambulance:${id}`),
      redis.del("ambulances:all")
    ]);

    return responseReturn(res, 200, { message: 'ডিলিট হয়েছে।' });
  } catch (error) {
    console.error('deleteAmbulance error:', error);
    return responseReturn(res, 500, { error: 'ডিলিটে সমস্যা হয়েছে।' });
  }
};

// 👨‍💼 Get Admin Ambulance Orders
const adminGetAmbulanceOrder = async (req, res) => {
  let { page = 1, parPage = 0, searchValue = "" } = req.query;
  page = parseInt(page);
  parPage = parseInt(parPage);
  const skip = parPage ? parPage * (page - 1) : 0;

  try {
    const query = searchValue
      ? { name: { $regex: searchValue, $options: 'i' } }
      : {};

    const [orders, totalAmbulance] = await Promise.all([
      userAmbulanceOrder.find(query)
        .skip(skip)
        .limit(parPage || 0)
        .sort({ createdAt: -1 }),

      userAmbulanceOrder.countDocuments(query),
    ]);

    return responseReturn(res, 200, { totalAmbulance, ambulances: orders });
  } catch (error) {
    console.error('adminGetAmbulanceOrder error:', error);
    return responseReturn(res, 500, { error: 'লোডে সমস্যা হয়েছে।' });
  }
};

// 🚨 Get Single Ambulance Order
const admin_ambulance_get = async (req, res) => {
  const { ambulanceId } = req.params;
  try {
    const order = await userAmbulanceOrder.findById(ambulanceId);
    if (!order) return responseReturn(res, 404, { error: 'না পাওয়া যায়।' });

    return responseReturn(res, 200, { ambulance: order });
  } catch (error) {
    console.error('admin_ambulance_get error:', error);
    return responseReturn(res, 500, { error: 'লোডে সমস্যা হয়েছে।' });
  }
};

// 🚦 Update Ambulance Order Status
const ambulance_order_status_update = async (req, res) => {
  const { ambulanceId } = req.params;
  const { status } = req.body;
  try {
    const order = await userAmbulanceOrder.findByIdAndUpdate(ambulanceId, { status });
    if (!order) return responseReturn(res, 404, { error: 'না পাওয়া যায়।' });

    return responseReturn(res, 200, { message: 'স্ট্যাটাস আপডেট হয়েছে।' });
  } catch (error) {
    console.error('ambulance_order_status_update error:', error);
    return responseReturn(res, 500, { error: 'স্ট্যাটাস আপডেটে সমস্যা।' });
  }
};

module.exports = {
  addAmbulance,
  getAmbulances,
  ambulance_get,
  ambulance_update,
  ambulance_image_update,
  deleteAmbulance,
  adminGetAmbulanceOrder,
  admin_ambulance_get,
  ambulance_order_status_update
};
