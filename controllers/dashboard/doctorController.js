const formidable = require("formidable");
const cloudinary = require("cloudinary").v2;
const doctorModel = require("../../models/doctorModel");
const { responseReturn } = require("../../utiles/response");
const redis = require("../../utiles/Redis");

// Helper: Redis key patterns
const doctorListCacheKeyPattern = (hospitalId) => `doctors:${hospitalId}:*`;
const doctorCacheKey = (doctorId) => `doctor:${doctorId}`;

// ======================== Add Doctor ========================
const add_doctor = async (req, res) => {
  const { id: hospitalId } = req;
  const form = formidable({
    multiples: false,
    maxFileSize: 2 * 1024 * 1024,
    filter: ({ mimetype }) =>
      ["image/jpeg", "image/png", "image/jpg", "image/webp"].includes(mimetype),
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return responseReturn(res, 400, { error: "ফর্ম ডেটা প্রসেস করা যায়নি।" });
    }

    try {
      const requiredFields = [
        "name",
        "category",
        "description",
        "fee",
        "qualification",
        "experience",
      ];
      for (const field of requiredFields) {
        if (!fields[field]) {
          return responseReturn(res, 400, {
            error: `${field} ফিল্ডটি পূরণ করুন।`,
          });
        }
      }

      if (!files.image) {
        return responseReturn(res, 400, {
          error: "ছবি অবশ্যই যুক্ত করতে হবে।",
        });
      }

      if (files.image.size > 2 * 1024 * 1024) {
        return responseReturn(res, 400, {
          error: "ছবির সাইজ সর্বোচ্চ ২MB হতে পারবে।",
        });
      }

      const processedName = fields.name.trim();
      const slug = processedName.replace(/\s+/g, "-").toLowerCase();

      // Cloudinary upload
      const { secure_url, public_id } = await cloudinary.uploader.upload(
        files.image.filepath,
        {
          folder: "doctors",
          transformation: [
            { width: 800, height: 600, crop: "fill", format: "webp" },
          ],
        }
      );

      let parsedSlots = [];
      if (fields.slots) {
        try {
          parsedSlots = JSON.parse(fields.slots);
          if (!Array.isArray(parsedSlots)) throw new Error();
        } catch {
          return responseReturn(res, 400, {
            error: "স্লট ফরম্যাট সঠিক নয়। একটি valid JSON Array দিন।",
          });
        }
      }

      // Create doctor in DB
      const doctor = await doctorModel.create({
        hospitalId,
        name: processedName,
        slug,
        category: fields.category.trim(),
        description: fields.description.trim(),
        fee: fields.fee.trim(),
        qualification: fields.qualification.trim(),
        experience: fields.experience.trim(),
        image: { url: secure_url, public_id },
        slots: parsedSlots,
      });

      // Clear related cache keys
      const listKeys = await redis.keys(doctorListCacheKeyPattern(hospitalId));
      if (listKeys.length) await redis.del(...listKeys);
      return responseReturn(res, 201, {
        message: "ডাক্তার সফলভাবে যোগ হয়েছে।",
        doctor,
      });
    } catch (error) {
      console.error("Doctor Add Error:", error);
      return responseReturn(res, 500, {
        error: "ডাটা যোগ করার সময় একটি সমস্যা হয়েছে।",
      });
    }
  });
};

// ======================== Get Doctors (with search & pagination) ========================
const doctors_get = async (req, res) => {
  const { page = 1, searchValue = "", parPage = 5 } = req.query;
  const { id: hospitalId } = req;

  const cacheKey = `doctors:${hospitalId}:search:${
    searchValue || "all"
  }:page:${page}:parPage:${parPage}`;

  try {
    // Redis cache check
    const cacheData = await redis.get(cacheKey);
    if (cacheData) {
      console.log("Cache hit ✅");
      return responseReturn(res, 200, JSON.parse(cacheData));
    }

    console.log("Cache miss ❌");

    const findQuery = { hospitalId };

    if (searchValue) {
      findQuery.$or = [
        { name: { $regex: searchValue, $options: "i" } },
        { category: { $regex: searchValue, $options: "i" } },
      ];
    }

    let doctors, totalDoctor;

    if (searchValue) {
      doctors = await doctorModel.find(findQuery).sort({ createdAt: -1 });
      totalDoctor = doctors.length;
    } else {
      const skipPage = parseInt(parPage) * (parseInt(page) - 1);

      [doctors, totalDoctor] = await Promise.all([
        doctorModel
          .find(findQuery)
          .skip(skipPage)
          .limit(parseInt(parPage))
          .sort({ createdAt: -1 }),
        doctorModel.countDocuments(findQuery),
      ]);
    }

    const responseData = { totalDoctor, doctors };

    await redis.set(cacheKey, JSON.stringify(responseData), "EX", 86400);

    return responseReturn(res, 200, responseData);
  } catch (error) {
    console.error("Doctors get error:", error);
    return responseReturn(res, 500, { error: error.message });
  }
};

// ======================== Get Single Doctor ========================
const doctor_get = async (req, res) => {
  const { doctorId } = req.params;
  const cacheKey = doctorCacheKey(doctorId);

  try {
    const cachedDoctor = await redis.get(cacheKey);
    if (cachedDoctor) {
      console.log("Cache hit ✅");
      return responseReturn(res, 200, { doctor: JSON.parse(cachedDoctor) });
    }

    console.log("Cache miss ❌");

    const doctor = await doctorModel.findById(doctorId).lean();
    if (!doctor) {
      return responseReturn(res, 404, { error: "ডাক্তার পাওয়া যায়নি।" });
    }

    await redis.set(cacheKey, JSON.stringify(doctor), "EX", 86400);

    return responseReturn(res, 200, { doctor });
  } catch (error) {
    console.error("Doctor fetch error:", error);
    return responseReturn(res, 500, {
      error: "সার্ভার সমস্যার কারণে ডাক্তার তথ্য পাওয়া যায়নি।",
    });
  }
};

// ======================== Update Doctor ========================
const doctor_update = async (req, res) => {
  let {
    name,
    category,
    description,
    fee,
    qualification,
    experience,
    doctorId,
    slots,
  } = req.body;
  console.log(doctorId, "doctorId");
  if (!doctorId) {
    return responseReturn(res, 400, { error: "doctorId প্রয়োজন।" });
  }

  name = name?.trim().replace(/[^\u0980-\u09FFa-zA-Z0-9\s-]/g, "") || "";
  const slug = name
    ? name.split(" ").join("-").toLowerCase()
    : `doctor-${doctorId}`;

  try {
    // Update and get updated doctor at once
    const updatedDoctor = await doctorModel.findByIdAndUpdate(
      doctorId,
      {
        name,
        category,
        description,
        fee,
        qualification,
        experience,
        slug,
        slots,
      },
      { new: true, runValidators: true }
    );

    if (!updatedDoctor) {
      return responseReturn(res, 404, { error: "ডাক্তার পাওয়া যায়নি।" });
    }

    // Helper functions for cache keys
    const doctorListCacheKeyPattern = (hospitalId) => `doctors:${hospitalId}:*`;
    const doctorCacheKey = (doctorId) => `doctor:${doctorId}`;

    // Clear related caches
    const listKeys = await redis.keys(
      doctorListCacheKeyPattern(updatedDoctor.hospitalId)
    );
    if (listKeys.length) await redis.del(...listKeys);

    await redis.del(doctorCacheKey(doctorId));
    // console.log(updatedDoctor)
    return responseReturn(res, 200, {
      doctor: updatedDoctor,
      message: "ডাক্তার আপডেট সফল।",
    });
  } catch (error) {
    console.error("Doctor update error:", error);
    return responseReturn(res, 500, { error: error.message });
  }
};

// ======================== Update Doctor Image ========================
const doctor_image_update = async (req, res) => {
  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return responseReturn(res, 400, { error: "ফর্ম ডেটা প্রসেস করা যায়নি।" });
    }

    const { doctorId, oldPublicId } = fields;
    const newImage = files.newImage || files.image; // fallback: support either newImage or image

    if (!doctorId) {
      return responseReturn(res, 400, { error: "doctorId প্রয়োজন।" });
    }

    if (!newImage) {
      return responseReturn(res, 400, { error: "নতুন ছবি যুক্ত করতে হবে।" });
    }

    try {
      cloudinary.config({
        cloud_name: process.env.cloud_name,
        api_key: process.env.api_key,
        api_secret: process.env.api_secret,
        secure: true,
      });

      if (oldPublicId) {
        await cloudinary.uploader.destroy(oldPublicId);
      }

      const result = await cloudinary.uploader.upload(newImage.filepath, {
        folder: "doctors",
        transformation: [
          { width: 800, height: 600, crop: "fill", fetch_format: "webp" },
        ],
      });

      await doctorModel.findByIdAndUpdate(doctorId, {
        image: {
          url: result.secure_url,
          public_id: result.public_id,
        },
      });

      const updatedDoctor = await doctorModel.findById(doctorId);

      // Clear related cache keys
      const listKeys = await redis.keys(
        doctorListCacheKeyPattern(updatedDoctor.hospitalId)
      );
      if (listKeys.length) await redis.del(...listKeys);

      await redis.del(doctorCacheKey(doctorId));

      return responseReturn(res, 200, {
        doctor: updatedDoctor,
        message: "ডাক্তার ইমেজ আপডেট সফল।",
      });
    } catch (error) {
      console.error("Doctor image update error:", error);
      return responseReturn(res, 500, { error: error.message });
    }
  });
};

// ======================== Delete Doctor ========================
const delete_doctor = async (req, res) => {
  const { id: doctorId } = req.params;

  try {
    const doctor = await doctorModel.findById(doctorId);
    if (!doctor) {
      return responseReturn(res, 404, { error: "ডাক্তার পাওয়া যায়নি।" });
    }

    if (doctor.image?.public_id) {
      await cloudinary.uploader.destroy(doctor.image.public_id);
    }

    await doctorModel.findByIdAndDelete(doctorId);

    // Cache invalidation
    const listKeys = await redis.keys(
      doctorListCacheKeyPattern(doctor.hospitalId)
    );
    if (listKeys.length) await redis.del(...listKeys);

    await redis.del(doctorCacheKey(doctorId));

    return responseReturn(res, 200, {
      message: "ডাক্তার সফলভাবে ডিলিট হয়েছে।",
    });
  } catch (error) {
    console.error("Doctor delete error:", error);
    return responseReturn(res, 500, {
      error: "সার্ভার সমস্যার কারণে ডিলিট করা যায়নি।",
    });
  }
};


const doctors_get_admin = async (req, res) => {
  try {
    let {
      page = 1,
      parPage = 12,
      searchValue = "",
      division = "",
      district = "",
      upazila = "",
      category = "",
    } = req.query;

    page = parseInt(page);
    parPage = parseInt(parPage);
    const skip = (page - 1) * parPage;

    // Build match stage
    const matchStage = {};
    if (category) matchStage.category = category;
    if (searchValue) matchStage.name = { $regex: searchValue.trim(), $options: "i" };

    // Aggregate query
    const doctorsAggregate = await doctorModel.aggregate([
      {
        $lookup: {
          from: "hospitals",
          localField: "hospitalId",
          foreignField: "_id",
          as: "hospital",
        },
      },
      { $unwind: "$hospital" },
      {
        $match: {
          ...matchStage,
          ...(division && { "hospital.division": division }),
          ...(district && { "hospital.district": district }),
          ...(upazila && { "hospital.upazila": upazila }),
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parPage },
      {
        $project: {
          doctorName: "$name",
          doctorCategory: { $ifNull: ["$category", "N/A"] },
          doctorExperience: { $ifNull: ["$experience", "N/A"] },
          doctorSlots: "$slots",
          doctorImage: "$image.url",
          hospitalName: "$hospital.name",
          division: "$hospital.division",
          district: "$hospital.district",
          upazila: "$hospital.upazila",
        },
      },
    ]);

    // Total count
    const totalCountAgg = await doctorModel.aggregate([
      {
        $lookup: {
          from: "hospitals",
          localField: "hospitalId",
          foreignField: "_id",
          as: "hospital",
        },
      },
      { $unwind: "$hospital" },
      {
        $match: {
          ...matchStage,
          ...(division && { "hospital.division": division }),
          ...(district && { "hospital.district": district }),
          ...(upazila && { "hospital.upazila": upazila }),
        },
      },
      { $count: "totalDoctor" },
    ]);

    const totalDoctor = totalCountAgg[0]?.totalDoctor || 0;

    responseReturn(res, 200, { doctors: doctorsAggregate, totalDoctor });
  } catch (error) {
    console.error("Doctors get admin error:", error);
    return res.status(500).json({ error: error.message });
  }
};



module.exports = {
  add_doctor,
  doctors_get,
  doctor_get,
  doctor_update,
  doctor_image_update,
  delete_doctor,
  doctors_get_admin,
};
