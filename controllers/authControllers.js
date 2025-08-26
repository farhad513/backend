const adminModel = require("../models/adminModel");
const hospitalModel = require("../models/hospital.model");
const sellerCustomerModel = require("../models/chat/sellerCustomerModel");
const bcrpty = require("bcrypt");
const formidable = require("formidable");
const cloudinary = require("cloudinary").v2;
const { responseReturn } = require("../utiles/response");
const { createToken } = require("../utiles/tokenCreate");
const mongoose = require("mongoose");
const redis = require("../utiles/Redis");
const userModel = require("../models/userModel");
// admin login
const admin_login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Input validation
    if (!email || !password) {
      return responseReturn(res, 400, {
        error: "ইমেইল এবং পাসওয়ার্ড উভয়ই প্রদান করা আবশ্যক।",
      });
    }

    // Find admin by email
    const admin = await adminModel.findOne({ email }).select("+password");
    if (!admin) {
      return responseReturn(res, 404, {
        error:
          "এই ইমেইল ঠিকানাটি আমাদের ডাটাবেসে পাওয়া যায়নি। অনুগ্রহ করে সঠিক ইমেইল দিন।",
      });
    }

    // Compare password
    const isPasswordMatch = await bcrpty.compare(password, admin.password);
    if (!isPasswordMatch) {
      return responseReturn(res, 401, {
        error: "পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে সঠিক পাসওয়ার্ড দিন।",
      });
    }

    // Create token
    const token = await createToken({
      id: admin.id,
      role: admin.role,
    });

    // Set secure cookie
    res.cookie("accessToken", token, {
      httpOnly: true, // 🔒 Security best practice
      secure: process.env.NODE_ENV === "production", // Only HTTPS in production
      sameSite: "strict", // CSRF protection
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Success response
    return responseReturn(res, 200, {
      token,
      message: "এডমিন লগইন সফল হয়েছে।",
    });
  } catch (error) {
    return responseReturn(res, 500, {
      error: "সার্ভারে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পরে চেষ্টা করুন।",
    });
  }
};

// hospital login
const hospital_login = async (req, res) => {
  const { email, password  } = req.body;
  
  try {
    // Input validation
    if (!email || !password) {
      return responseReturn(res, 400, {
        error: "ইমেইল এবং পাসওয়ার্ড উভয়ই প্রদান করা আবশ্যক।",
      });
    }

    // Find hospital by email
    const hospital = await hospitalModel.findOne({ email }).select("+password");
    if (!hospital) {
      return responseReturn(res, 404, {
        error: "এই ইমেইল ঠিকানাটি আমাদের ডাটাবেসে পাওয়া যায়নি। অনুগ্রহ করে সঠিক ইমেইল দিন।",
      });
    }

    // Compare password
    const isPasswordMatch = await bcrpty.compare(password, hospital.password);
    if (!isPasswordMatch) {
      return responseReturn(res, 401, {
        error: "পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে সঠিক পাসওয়ার্ড দিন।",
      });
    }

   
    // Create token
    const token = await createToken({
      id: hospital.id,
      role: hospital.role,
      status: hospital.status,
    });

    // Set secure cookie
    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });

    return responseReturn(res, 200, {
      token,
      message: `হাসপাতাল লগইন সফল হয়েছে।`,
    });
  } catch (error) {
    return responseReturn(res, 500, {
      error: "সার্ভারে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পরে চেষ্টা করুন।",
    });
  }
};


// hospital register
const hospital_register = async (req, res) => {
  const { email, name, password, phone } = req.body;

  try {
    // Input validation
    if (!email || !name || !password || !phone) {
      return responseReturn(res, 400, {
        error: "সব তথ্য প্রদান করা আবশ্যক। অনুগ্রহ করে সকল ঘর পূরণ করুন।",
      });
    }

    if (password.length < 6) {
      return responseReturn(res, 400, {
        error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।",
      });
    }

    // Check if email already exists
    const existingUser = await hospitalModel.findOne({ email });
    if (existingUser) {
      return responseReturn(res, 409, {
        error:
          "এই ইমেইল ঠিকানাটি ইতোমধ্যেই ব্যবহৃত হয়েছে। অনুগ্রহ করে অন্য একটি ইমেইল দিন।",
      });
    }

    // Create hospital account
    const hashedPassword = await bcrpty.hash(password, 10);
    const hospital = await hospitalModel.create({
      name,
      email,
      password: hashedPassword,
      phone,
    });

    // Create seller-customer mapping
    await sellerCustomerModel.create({
      myId: hospital.id,
    });

    // Generate token
    const token = await createToken({
      id: hospital.id,
      role: hospital.role,
      status: hospital.status,
    });

    // Set cookie
    res.cookie("accessToken", token, {
      httpOnly: true, // 🔒 Security best practice
      secure: process.env.NODE_ENV === "production", // Only HTTPS in production
      sameSite: "strict", // CSRF protection
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Send success response
    return responseReturn(res, 201, {
      token,
      message: ` হাসপাতাল নিবন্ধন সফল হয়েছে। স্বাগতম!`,
    });
  } catch (error) {
    return responseReturn(res, 500, {
      error: "সার্ভারে সমস্যা হয়েছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।",
    });
  }
};

// saved notification token
const pushTokenNot = async (req, res) => {
    const { pushToken } = req.body;
    const userId = req.id; // JWT middleware থেকে আসবে
  try {
    // ID valid কিনা চেক করা


   
     if (!pushToken) {
      return res.status(400).json({ message: "Token missing" });
    }
  const hospital = await hospitalModel.findById(userId);
    if (!hospital) return res.status(404).json({ error: "Hospital not found" });
    hospital.expoPushToken = pushToken; // এখানে সেট করো
    await hospital.save();
    return responseReturn(res, 200, { hospital, message :"Push token saved"  });
  } catch (error) {
    return responseReturn(res, 500, {
      error: "ভাই, সার্ভারে কিছু একটা সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।",
    });
  }
};

const pushTokenNotAdmin = async (req, res) => {
    const { pushToken } = req.body;
    const userId = req.id; // JWT middleware থেকে আসবে
  try {
    // ID valid কিনা চেক করা


   
     if (!pushToken) {
      return res.status(400).json({ message: "Token missing" });
    }
  const admin = await adminModel.findById(userId);
    if (!admin) return res.status(404).json({ error: "Admin not found" });
    admin.expoPushToken = pushToken; // এখানে সেট করো
    await admin.save();
    return responseReturn(res, 200, { admin, message :"Push token saved"  });
  } catch (error) {
    console.error("ইউজার তথ্য আনতে সমস্যা:", error);
    return responseReturn(res, 500, {
      error: "ভাই, সার্ভারে কিছু একটা সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।",
    });
  }
};



const getUser = async (req, res) => {
  const { id, role } = req;

  try {
    // ID valid কিনা চেক করা
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return responseReturn(res, 400, {
        error: "দুঃখিত, ইউজার আইডি সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।",
      });
    }

    const cacheKey = `${role}:${id}`;
    const cachedData = await redis.get(cacheKey);

    // ক্যাশে থাকলে সেটাই রিটার্ন
    if (cachedData) {
      return responseReturn(res, 200, {
        userInfo: JSON.parse(cachedData),
        cache: true,
      });
    }

    // ডেটাবেজ থেকে ডেটা আনা
    let userInfo;
    if (role === "admin") {
      userInfo = await adminModel.findById(id).lean();
    } else {
      userInfo = await hospitalModel.findById(id).lean();
    }

    // ইউজার না থাকলে
    if (!userInfo) {
      return responseReturn(res, 404, {
        error: "দুঃখিত, কোনো ইউজার তথ্য পাওয়া যায়নি।",
      });
    }

    // ক্যাশে সেট করা (১ দিন = 86400 সেকেন্ড)
    // await redis.set(cacheKey, JSON.stringify(userInfo), "EX", 86400);
    return responseReturn(res, 200, { userInfo, cache: false });
  } catch (error) {
    console.error("ইউজার তথ্য আনতে সমস্যা:", error);
    return responseReturn(res, 500, {
      error: "ভাই, সার্ভারে কিছু একটা সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।",
    });
  }
};
// profile image upload
const profile_image_upload = async (req, res) => {
  const { id } = req;

  // Parse form data using formidable
  const form = formidable({ multiples: false, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return responseReturn(res, 400, {
        error: "ফাইল প্রসেস করতে ত্রুটি হয়েছে।",
      });
    }

    try {
      // প্রথমে হসপিটালের ডাটা ফেচ করো
      const hospital = await hospitalModel.findById(id);

      if (!hospital) {
        return responseReturn(res, 404, { error: "হাসপাতাল পাওয়া যায়নি।" });
      }

      // যদি ইতিমধ্যেই image থাকে → update ব্লক করে দাও
      if (hospital.image) {
        return responseReturn(res, 400, {
          error: "আপনি ইতিমধ্যেই প্রোফাইল ছবি আপলোড করেছেন, পরিবর্তন করা যাবে না।",
        });
      }

      const { image } = files;
      if (!image) {
        return responseReturn(res, 400, { error: "আপনি কোনো ছবি আপলোড করেননি।" });
      }

      // Validate image file type and size
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
      const maxSize = 1 * 1024 * 1024; // ১MB

      if (image.mimetype === "application/pdf") {
        return responseReturn(res, 400, {
          error:
            "PDF ফাইল আপলোড করা যাবে না। শুধুমাত্র JPG, PNG অথবা GIF আপলোড করুন।",
        });
      }

      if (!allowedMimeTypes.includes(image.mimetype)) {
        return responseReturn(res, 400, {
          error: "শুধুমাত্র JPG, PNG এবং GIF ফাইল আপলোড করা যাবে।",
        });
      }

      if (image.size > maxSize) {
        return responseReturn(res, 400, {
          error: "ছবির আকার ১MB এর বেশি হতে পারবে না।",
        });
      }

      // Cloudinary config
      cloudinary.config({
        cloud_name: process.env.cloud_name,
        api_key: process.env.api_key,
        api_secret: process.env.api_secret,
        secure: true,
      });

      // নতুন ছবি আপলোড করা (ডিলিট করার দরকার নেই কারণ আগে কোনো image ছিল না)
      const result = await cloudinary.uploader.upload(image.filepath, {
        folder: "profile",
        public_id: `profile-${id}`,
        resource_type: "image",
        overwrite: false,
      });

      if (result) {
        // নতুন ছবি URL ডাটাবেজে সেট করা
        await hospitalModel.findByIdAndUpdate(id, { image: result.url });

        // আপডেট করা ইউজার ইনফো রিটার্ন করা
        const userInfo = await hospitalModel.findById(id);

        return responseReturn(res, 201, {
          message: "ছবি সফলভাবে আপলোড করা হয়েছে।",
          userInfo,
        });
      } else {
        return responseReturn(res, 500, { error: "ছবি আপলোড ব্যর্থ হয়েছে।" });
      }
    } catch (error) {
      console.error(error);
      return responseReturn(res, 500, {
        error: "সার্ভারে ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
      });
    }
  });
};


// profile info add
const profile_info_add = async (req, res) => {
  const {
    division,
    district,
    upazila,
    address,
    type,
    license,
    website,
    emergency,
    openingTime,
    closingTime,
    billDiscount,
    pathologyDiscount,
  } = req.body;

  const { id } = req;

  try {
    const hospital = await hospitalModel.findById(id).select("profileUpdated");

    if (!hospital) {
      return responseReturn(res, 404, {
        error: "হাসপাতাল পাওয়া যায়নি।",
      });
    }

    if (hospital.profileUpdated) {
      return responseReturn(res, 400, {
        error:
          "আপনি ইতিমধ্যে আপনার প্রোফাইল আপডেট করেছেন। আরো পরিবর্তনের জন্য অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।",
      });
    }

    const updateData = {
      division,
      district,
      upazila,
      address,
      type,
      license,
      website,
      emergency,
      openingTime,
      closingTime,
      billDiscount,
      pathologyDiscount,
      profileUpdated: true,
    };

    const updatedHospital = await hospitalModel
      .findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true, context: "query" }
      )
      .lean();

    // 🔥 ক্যাশ ডিলিট করে দেওয়া (যদি hospital:{id} নামে ক্যাশ করা থাকে)
    await redis.del(`hospital:${id}`);

    // ✅ চাইলে এখানেই নতুন ক্যাশ সেটও করতে পারো, ধরো:
    await redis.set(
      `hospital:${id}`,
      JSON.stringify(updatedHospital),
      "EX",
      900 // ১৫ মিনিট
    );

    return responseReturn(res, 201, {
      message: "প্রোফাইল তথ্য সফলভাবে যুক্ত করা হয়েছে।",
      userInfo: updatedHospital,
    });
  } catch (error) {
    console.error("Profile Info Update Error:", error);
    return responseReturn(res, 500, {
      error: "সার্ভার ত্রুটি ঘটেছে। দয়া করে পরে আবার চেষ্টা করুন।",
    });
  }
};

//  logout
const logout = async (req, res) => {
  console.log(req.id, "req thake id");
  try {
    // Token Cookie clear করা
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    // ক্যাশ ডিলিট করা (যদি req.id থাকে এবং সেটা hospital id)
    if (req.id) {
      await redis.del(`hospital:${req.id}`);
    }

    return responseReturn(res, 200, { message: "লগআউট সফল হয়েছে।" });
  } catch (error) {
    console.error("Logout Error:", error);
    return responseReturn(res, 500, {
      error: "সার্ভার ত্রুটি। পরে আবার চেষ্টা করুন।",
    });
  }
};

const get_all_users = async (req, res) => {
  let { page = 1, parPage = 5, searchValue = "" } = req.query;

  page = parseInt(page);
  parPage = parseInt(parPage);
  const skip = (page - 1) * parPage;

  const searchQuery = {};

  if (searchValue) {
    searchQuery["$or"] = [
      { name: { $regex: searchValue, $options: "i" } },
      { email: { $regex: searchValue, $options: "i" } },
      { phone: { $regex: searchValue, $options: "i" } },
    ];
  }

  try {
    const users = await userModel
      .find(searchQuery)
      .skip(skip)
      .limit(parPage)
      .sort({ createdAt: -1 });

    const totalUsers = await userModel.countDocuments(searchQuery);

    responseReturn(res, 200, {
      totalUsers,
      users,
    });
  } catch (error) {
    responseReturn(res, 500, { error: error.message });
  }
};

module.exports = {
  admin_login,
  hospital_login,
  hospital_register,
  getUser,
  profile_image_upload,
  profile_info_add,
  logout,
  get_all_users,
  pushTokenNot,
  pushTokenNotAdmin
};
