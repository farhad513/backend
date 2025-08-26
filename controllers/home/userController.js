const userModel = require("../../models/userModel");
const { responseReturn } = require("../../utiles/response");
const { createToken } = require("../../utiles/tokenCreate");
const sellerCustomerModel = require("../../models/chat/sellerCustomerModel");
const formidable = require("formidable");
const cloudinary = require("cloudinary").v2;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const redis = require("../../utiles/Redis");
const { default: mongoose } = require("mongoose");
const {
  sendOtp,
  getStoredOtp,
  deleteStoredOtp,
} = require("../../utiles/sendOtp");
// const notificationModel = require("../../models/notification.model")

const sendOtpForRegistration = async (req, res) => {
  const { name, phone, password } = req.body;
  try {
    if (!name || !phone || !password) {
      return responseReturn(res, 400, {
        error: "সকল তথ্য প্রদান করুন।",
      });
    }

    if (password.length < 6) {
      return responseReturn(res, 400, {
        error: "পাসওয়ার্ড কমপক্ষে ৬টি অক্ষরের হতে হবে।",
      });
    }

    const existingUser = await userModel.findOne({ phone });
    if (existingUser) {
      return responseReturn(res, 400, {
        error: "এই ফোন নম্বরটি আগে থেকেই রেজিস্টারড।",
      });
    }

    // sendOtp ফাংশন কল করে OTP তৈরি ও SMS পাঠানো হবে
    const otpCode = await sendOtp(phone);

    responseReturn(res, 200, {
      message: "OTP পাঠানো হয়েছে।",
      otp: otpCode,
    });
  } catch (error) {
    console.log(error);
    responseReturn(res, 500, {
      error: "OTP পাঠাতে সমস্যা হয়েছে।",
    });
  }
};

const verifyAndRegister = async (req, res) => {
  const { name, phone, password, otp } = req.body;
  try {
    const savedOtpData = getStoredOtp(phone);

    if (!savedOtpData) {
      return responseReturn(res, 400, {
        error: "OTP পাওয়া যায়নি বা মেয়াদোত্তীর্ণ।",
      });
    }

    if (savedOtpData.code !== otp) {
      return responseReturn(res, 400, { error: "OTP সঠিক নয়।" });
    }

    if (savedOtpData.expiresAt < new Date()) {
      deleteStoredOtp(phone);
      return responseReturn(res, 400, { error: "OTP মেয়াদোত্তীর্ণ হয়েছে।" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const createUser = await userModel.create({
      name: name.trim(),
      phone: phone.trim(),
      password: hashedPassword,
    });

    const { password: pwd, ...userWithoutPassword } = createUser.toObject();

    const token = await createToken({
      id: userWithoutPassword._id,
      role: userWithoutPassword.role,
      name: userWithoutPassword.name,
      phone: userWithoutPassword.phone,
    });

    res.cookie("userToken", token, {
      httpOnly: true,
      secure: false,
      sameSite: "Strict",
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

    deleteStoredOtp(phone); // OTP ইন-মেমরি থেকে মুছে ফেলো

    responseReturn(res, 201, {
      message: "রেজিস্ট্রেশন সফল হয়েছে।",
      token,
    });
  } catch (error) {
    console.log(error);
    responseReturn(res, 500, { error: "সার্ভার ত্রুটি হয়েছে।" });
  }
};

const user_login = async (req, res) => {
  const { phone, password } = req.body;
  console.log(req.body);
  try {
    // ইউজার খুঁজে বের করলাম
    const user = await userModel.findOne({ phone }).select("+password");

    if (password.length < 6) {
      return responseReturn(res, 400, {
        error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে",
      });
    }

    if (user) {
      const match = await bcrypt.compare(password, user.password);

      if (match) {
        // password বাদ দিয়ে user object তৈরি
        const { password, ...userWithoutPassword } = user.toObject();

        // JWT token তৈরি
        const token = await createToken({
          id: userWithoutPassword._id,
          role: userWithoutPassword.role,
          name: userWithoutPassword.name,
          phone: userWithoutPassword.phone,
        });

        // cookie তে সেট করলাম
        res.cookie("userToken", token, {
          httpOnly: true,
          secure: false, // For development with HTTP
          sameSite: "Strict",
          expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });

        responseReturn(res, 201, { message: "লগইন সফল হয়েছে", token });
      } else {
        responseReturn(res, 404, { error: "পাসওয়ার্ড ভুল হয়েছে" });
      }
    } else {
      responseReturn(res, 404, { error: "ফোন নাম্বার খুঁজে পাওয়া যায়নি" });
    }
  } catch (error) {
    responseReturn(res, 500, { error: error.message });
  }
};

const user_logout = async (req, res) => {
  res.cookie("userToken", "", {
    maxAge: 0,
    path: "/",
    sameSite: "Strict",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  responseReturn(res, 200, { message: "লগআউট সফলভাবে হয়েছে" });
};

// get user  all hospitals list
const query_bloodDoners = async (req, res) => {
  let {
    page = 1,
    parPage = 5,
    division = "",
    district = "",
    upazila = "",
    bloodGroup = "",
  } = req.query;

  page = parseInt(page);
  parPage = parseInt(parPage);
  const skip = (page - 1) * parPage;

  const fourMonthsAgo = new Date();
  fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

  // Logged-in user এর upazila
  let userUpazila = "";
  if (req.user?.id) {
    const user = await userModel.findById(req.user.id);
    userUpazila = user?.upazila || "";
  }

  // query parameter আর না থাকলে user-এর upazila ধরবো
  const finalUpazila = upazila || userUpazila;

  // filter query বানানো
  const filterQuery = {
    gender: "পুরুষ",
    donateBlood: "হ্যাঁ",
    $or: [
      { lastBloodDate: { $exists: false } },
      { lastBloodDate: { $lte: fourMonthsAgo } },
    ],
  };

  if (division) {
    filterQuery["division"] = division;
  }
  if (district) {
    filterQuery["district"] = district;
  }
  if (finalUpazila) {
    filterQuery["upazila"] = finalUpazila;
  }
  if (bloodGroup) {
    filterQuery["bloodGroup"] = bloodGroup;
  }

  try {
    const users = await userModel
      .find(filterQuery)
      .skip(skip)
      .limit(parPage)
      .sort({ createdAt: -1 });

    const totalDonners = await userModel.countDocuments(filterQuery);
    console.log(totalDonners);
    responseReturn(res, 200, { totalDonners, users });
  } catch (error) {
    responseReturn(res, 500, { error: error.message });
  }
};

const convertBanglaNumberToEnglish = (str) => {
  if (!str) return str;
  const banglaDigits = "০১২৩৪৫৬৭৮৯";
  const englishDigits = "0123456789";
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const index = banglaDigits.indexOf(char);
    result += index > -1 ? englishDigits[index] : char;
  }
  return result;
};

const profileAddedOrUpdated = async (req, res) => {
  const { id } = req;

  let {
    dob,
    gender,
    bloodGroup,
    division,
    district,
    upazila,
    lastBloodDate,
    address,
    age,
    email,
    name,
    donateBlood,
    totalDonate,
  } = req.body;

  try {
    const user = await userModel.findById(id);
    if (!user) {
      return responseReturn(res, 404, { message: "User not found" });
    }

    // 👉 Convert Bangla number to English
    dob = convertBanglaNumberToEnglish(dob);
    lastBloodDate = convertBanglaNumberToEnglish(lastBloodDate);

    // 👉 Default avatar setup
    const defaultImages = {
      male: "https://i.ibb.co/qLT0W427/male.jpg",
      female: "https://i.ibb.co/4H271x7/female.jpg",
    };

    let avatar = user.avatar;

    if (gender === "পুরুষ") {
      avatar = {
        url: defaultImages.male,
        public_id: "N/A",
      };
    } else if (gender === "মহিলা") {
      avatar = {
        url: defaultImages.female,
        public_id: "N/A",
      };
    }

    // Ensure avatar url is a string to avoid validation error
    if (typeof avatar?.url !== "string") {
      avatar.url = String(avatar.url);
    }

    // 👉 Update user profile
    const updatedUser = await userModel.findByIdAndUpdate(
      id,
      {
        dob,
        gender,
        bloodGroup,
        division,
        district,
        upazila,
        lastBloodDate,
        address,
        age,
        email,
        name,
        donateBlood,
        totalDonate,
        avatar: {
          url: avatar.url,
          public_id: avatar.public_id || "N/A",
        },
      },
      { new: true }
    );

    // 👉 Redis cache update
    const cacheKey = `user:${id}`;
    await redis.del(cacheKey);
    await redis.set(cacheKey, JSON.stringify(updatedUser), "EX", 86400); // 1 day

    // 👉 Create token
    const token = await createToken({
      id: updatedUser._id,
      name: updatedUser.name,
      phone: updatedUser.phone,
    });

    // 👉 Set cookie
    res.cookie("userToken", token, {
      httpOnly: true,
      secure: false,
      sameSite: "Strict",
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // 👉 Final response
    responseReturn(res, 201, {
      message: "প্রোফাইল সফলভাবে আপডেট হয়েছে",
      token,
      updatedUser,
    });
  } catch (error) {
    console.error("Update Error:", error);
    responseReturn(res, 500, { error: error.message });
  }
};

const getUser = async (req, res) => {
  const { id } = req;
  console.log(id, "user Id");
  // consle.log()
  try {
    // ID valid কিনা চেক করা
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return responseReturn(res, 400, {
        error: "দুঃখিত, ইউজার আইডি সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।",
      });
    }

    const cacheKey = `user:${id}`;
    const cachedData = await redis.get(cacheKey);

    // ক্যাশে থাকলে সেটাই রিটার্ন
    if (cachedData) {
      return responseReturn(res, 200, {
        userInfo: JSON.parse(cachedData),
        cache: true,
      });
    }

    // ডেটাবেজ থেকে ইউজার ডেটা আনা
    const userInfo = await userModel.findById(id).lean();

    // ইউজার না থাকলে
    if (!userInfo) {
      return responseReturn(res, 404, {
        error: "দুঃখিত, কোনো ইউজার তথ্য পাওয়া যায়নি।",
      });
    }

    // ক্যাশে সেট করা (১ দিন = 86400 সেকেন্ড)
    await redis.set(cacheKey, JSON.stringify(userInfo), "EX", 86400);
    console.log(userInfo);
    return responseReturn(res, 200, { userInfo, cache: false });
  } catch (error) {
    console.error("ইউজার তথ্য আনতে সমস্যা:", error);
    return responseReturn(res, 500, {
      error: "ভাই, সার্ভারে কিছু একটা সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।",
    });
  }
};

const user_image_upload = async (req, res) => {
  const { id } = req; // Middleware থেকে বা token থেকে আসবে
  console.log(id, "id User image upload");
  // Formidable সেটআপ
  const form = formidable({ multiples: false, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return responseReturn(res, 400, {
        error: "ফাইল প্রসেস করতে ত্রুটি হয়েছে।",
      });
    }

    const { image } = files;
    console.log(image, "user thake image pai ki na check korte chi");
    if (!image) {
      return responseReturn(res, 400, { error: "আপনি কোনো ছবি আপলোড করেননি।" });
    }

    // ফাইল টাইপ এবং সাইজ যাচাই
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

    // Cloudinary config (environment variables থেকে)
    cloudinary.v2.config({
      cloud_name: process.env.CLOUD_NAME,
      api_key: process.env.api_key,
      api_secret: process.env.api_secret,
      secure: true,
    });

    try {
      // আগের ছবি ডিলিট (public_id হিসাবে user-{id} ধরে নিচ্ছি)
      await cloudinary.v2.uploader.destroy(`user-${id}`);

      // নতুন ছবি আপলোড
      const result = await cloudinary.v2.uploader.upload(image.filepath, {
        folder: "user_profile",
        public_id: `user-${id}`,
        resource_type: "image",
        overwrite: true,
      });

      if (!result) {
        return responseReturn(res, 500, { error: "ছবি আপলোড ব্যর্থ হয়েছে।" });
      }

      // ইউজারের ডাটাবেজ আপডেট
      await userModel.findByIdAndUpdate(id, {
        avatar: {
          url: result.secure_url,
          public_id: `user-${id}`,
        },
      });
      // আপডেট ইউজার ডাটা রিটার্ন
      const updatedUser = await userModel.findById(id).select("-password"); // password বাদ দিলে ভালো হয়

      return responseReturn(res, 201, {
        message: "ছবি সফলভাবে আপলোড করা হয়েছে।",
        userInfo: updatedUser,
      });
    } catch (error) {
      console.error("user_image_upload error:", error);
      return responseReturn(res, 500, {
        error: "সার্ভারে ত্রুটি ঘটেছে। পরে আবার চেষ্টা করুন।",
      });
    }
  });
};

const pushTokenUser = async (req, res) => {
  const { pushToken } = req.body;
  console.log(pushToken, "pushtoken");
  const userId = req.id; // JWT middleware থেকে আসবে
  console.log(userId, "userId push token user");
  try {
    // ID valid কিনা চেক করা
    if (!pushToken) {
      return res.status(400).json({ message: "Token missing" });
    }
    const user = await userModel.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.expoPushToken = pushToken; // এখানে সেট করো
    await user.save();
    return responseReturn(res, 200, { user, message: "Push token saved" });
  } catch (error) {
    console.error("ইউজার তথ্য আনতে সমস্যা:", error);
    return responseReturn(res, 500, {
      error: "ভাই, সার্ভারে কিছু একটা সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।",
    });
  }
};

module.exports = {
  user_login,
  user_logout,
  query_bloodDoners,
  profileAddedOrUpdated,
  getUser,
  user_image_upload,
  sendOtpForRegistration,
  verifyAndRegister,
  pushTokenUser,
};
