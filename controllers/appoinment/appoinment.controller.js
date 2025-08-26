const authorAppoinmentModel = require("../../models/auth.appoinment.model");
const mongoose = require("mongoose");
const customerAppoinmentModel = require("../../models/customerAppoinment");
const notificationModel = require("../../models/notification.model");
const { responseReturn } = require("../../utiles/response");
const moment = require("moment");
const redis = require("../../utiles/Redis"); // Redis client import
const {
  clearAdminAppointmentsCache,
  clearUserAppointmentsCache,
  clearHospitalAppointmentsCache,
  clearSingleAppointmentCache,
} = require("./appoinmentCache");
const { sendSms } = require("../../utiles/sendSms");
const userModel = require("../../models/userModel");
const hospitalModel = require("../../models/hospital.model");
require("moment/locale/bn"); // বাংলা লোকেল লোড

const convertToEnglishNumber = (input) => {
  if (!input) return "";
  const banglaNums = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  const engNums = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  let output = input;
  banglaNums.forEach((bn, i) => {
    const regex = new RegExp(bn, "g");
    output = output.replace(regex, engNums[i]);
  });
  return output;
};

const placeAppointment = async (req, res) => {
  const {
    userId,
    doctorId,
    hospitalId,
    name,
    phone,
    appointmentDate,
    address,
    age,
    purpose,
  } = req.body;

  try {
    if (!appointmentDate) {
      return res
        .status(400)
        .json({ message: "অ্যাপয়েন্টমেন্টের তারিখ দিতে হবে।" });
    }

    const engDate = convertToEnglishNumber(appointmentDate);
    const [day, month, year] = engDate.split("-");
    if (!day || !month || !year) {
      return res.status(400).json({ message: "অবৈধ অ্যাপয়েন্টমেন্ট তারিখ।" });
    }

    const parsedDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "অবৈধ অ্যাপয়েন্টমেন্ট তারিখ।" });
    }

    const convertedPhone = convertToEnglishNumber(phone);
    const pending = await customerAppoinmentModel.findOne({
      userId,
      status: "pending",
    });

    if (pending) {
      return res.status(400).json({
        message: "আপনার পূর্বের একটি অ্যাপয়েন্টমেন্ট এখনও pending আছে।",
      });
    }

    const booking = await customerAppoinmentModel.create({
      userId,
      doctorId,
      hospitalId,
      patientName: name,
      phone: convertedPhone,
      appointmentDate: parsedDate,
      age,
      purpose,
      address,
      status: "pending",
    });

    const authorAppointment = await authorAppoinmentModel.create({
      appoinmentId: booking._id,
      hospitalId,
      doctorId,
      status: "pending",
      address,
      userId,
      date: parsedDate,
    });

    // ✅ Clear old caches
    await clearAdminAppointmentsCache();
    await clearUserAppointmentsCache(userId);
    await clearHospitalAppointmentsCache(hospitalId);
    await clearSingleAppointmentCache(booking._id);

    // ✅ Re-cache (populate doctor & hospital)
    const populated = await authorAppoinmentModel
      .findById(authorAppointment._id)
      .populate("doctorId", "name category")
      .populate("hospitalId", "name");

    // ✅ হাসপাতালকে এসএমএস পাঠানো
    const hospital = await hospitalModel.findById(hospitalId);
    const hospitalPhone = hospital?.phone;
    const hospitalName = hospital?.name;
    const doctorInfo = populated?.doctorId;
    const doctorName = doctorInfo?.name;
    const patientName = name;
    if (hospitalPhone) {
      const smsMessage = ` নতুন অ্যাপয়েন্টমেন্ট বুক করা হয়েছে।
    👤 রোগীর নাম: ${patientName} 🩺 চিকিৎসক: ${doctorName} 
    📲 বিস্তারিত জানতে অনুগ্রহ করে হসপিটাল অ্যাপে লগইন করুন।
    ধন্যবাদ।
    — মেডি ফাস্ট হেলথ কেয়ার`;

      await sendSms(hospitalPhone, smsMessage);
    }

    res.status(201).json({
      message: "অ্যাপয়েন্টমেন্ট বুক হয়েছে সফলভাবে",
      appointmentId: booking._id,
    });
  } catch (error) {
    console.log("Place Appointment Error:", error.message);
    res.status(500).json({ message: "অ্যাপয়েন্টমেন্ট বুক করা যায়নি।" });
  }
};

// ✅ User-wise Appointment List
const get_appoinments = async (req, res) => {
  const { userId, status } = req.params;
  let { page = 1, parPage = 5 } = req.query;
  console.log(status, "status status");
  page = parseInt(page);
  parPage = parseInt(parPage);
  const skipPage = parPage * (page - 1); // ✅ typo fix

  try {
    // ইউজার আইডি ভ্যালিড কিনা চেক
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return responseReturn(res, 400, { message: "অবৈধ ইউজার আইডি।" });
    }

    // ক্যাশ কী তৈরি
    const cacheKey = `user:${userId}:appointments:${
      status || "all"
    }:page${page}`;

    // ক্যাশড ডেটা থাকলে সেটা রিটার্ন
    const cached = await redis.get(cacheKey);
    if (cached) {
      return responseReturn(res, 200, JSON.parse(cached));
    }

    // ডাইনামিক কুয়েরি সেটআপ
    const query = { userId: new mongoose.Types.ObjectId(userId) };
    if (status && status !== "all") {
      query.status = status;
    }

    // টোটাল অ্যাপয়েন্টমেন্ট কাউন্ট
    const totalAppointments = await customerAppoinmentModel.countDocuments(
      query
    );

    // অ্যাপয়েন্টমেন্ট লিস্ট ফেচ
    const appointments = await customerAppoinmentModel
      .find(query)
      .populate("doctorId", "name image category")
      .skip(skipPage)
      .sort({ createdAt: -1 })
      .limit(parPage);

    // ফাইনাল রেজাল্ট
    const result = {
      message: "অ্যাপয়েন্টমেন্ট লোড হয়েছে।",
      appointments,
      totalAppointments,
    };

    // ক্যাশ সেট (১৫ মিনিট)
    await redis.setex(cacheKey, 900, JSON.stringify(result));

    // রেসপন্স রিটার্ন
    responseReturn(res, 200, result);
  } catch (error) {
    console.log("Appointment API Error:", error);
    responseReturn(res, 500, { message: "সার্ভারে ত্রুটি।" });
  }
};

// ✅ Admin Appointment List
const get_admin_appoinments = async (req, res) => {
  let { page = 1, parPage = 5, searchValue } = req.query;
  page = parseInt(page);
  parPage = parseInt(parPage);
  const skipPage = parPage * (page - 1);

  try {
    const cacheKey = `admin:appointments:page${page}:search:${
      searchValue || "none"
    }`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return responseReturn(res, 200, JSON.parse(cached));
    }

    let query = {};
    if (searchValue) {
      if (/^[0-9a-fA-F]{24}$/.test(searchValue)) {
        // ObjectId হিসেবে
        query = { _id: searchValue };
      } else if (/^01[0-9]{9}$/.test(searchValue)) {
        // ফোন নাম্বার হিসেবে
        query = { phone: searchValue };
      } else {
        // নাম দিয়ে সার্চ
        query = { patientName: { $regex: searchValue, $options: "i" } };
      }
    }

    const appointments = await customerAppoinmentModel
      .find(query)
      .skip(skipPage)
      .limit(parPage)
      .sort({ createdAt: -1 })
      .populate("doctorId", "name category")
      .populate("hospitalId", "name")
      .populate("userId", "name phone");
    const totalAppointments = await customerAppoinmentModel.countDocuments(
      query
    );

    const result = { appointments, totalAppointments };
    await redis.setex(cacheKey, 900, JSON.stringify(result));

    responseReturn(res, 200, result);
  } catch (error) {
    console.log(error);
    responseReturn(res, 500, { message: "server error" });
  }
};

const engToBnNumber = (number) => {
  return number.toString().replace(/[0-9]/g, (digit) => "০১২৩৪৫৬৭৮৯"[digit]);
};

const hospital_appoinment_status_update = async (req, res) => {
  const { appoinmentId } = req.params;
  const { status, appointmentDate, serial, time } = req.body;

  try {
    const author = await authorAppoinmentModel.findById(appoinmentId);
    if (!author)
      return responseReturn(res, 404, { message: "ডাটা পাওয়া যায়নি।" });

    const customer = await customerAppoinmentModel
      .findById(author.appoinmentId)
      .populate("doctorId");
    console.log(customer)
    if (!customer)
      return responseReturn(res, 404, { message: "ডাটা পাওয়া যায়নি।" });

    // ✅ যদি অ্যাপয়েন্টমেন্ট সম্পন্ন হয়, আর পরিবর্তন করা যাবে না
    if (customer.isComplete) {
      return responseReturn(res, 400, {
        message: "অ্যাপয়েন্টমেন্ট ইতোমধ্যে সম্পন্ন হয়েছে, পরিবর্তন করা যাবে না।",
      });
    }

    const isComplete = status === "confirmed";

    // ✅ ডাটাবেস আপডেট
    await authorAppoinmentModel.findByIdAndUpdate(appoinmentId, {
      status,
      appointmentDate,
      serial,
      isComplete,
      time,
    });

    await customerAppoinmentModel.findByIdAndUpdate(author.appoinmentId, {
      status,
      appointmentDate,
      serial,
      isComplete,
      time,
    });

    // ✅ Cache Clear
    await clearAdminAppointmentsCache();
    await clearUserAppointmentsCache(author.userId);
    await clearHospitalAppointmentsCache(author.hospitalId);
    await clearSingleAppointmentCache(appoinmentId);

    // ✅ SMS এর জন্য প্রস্তুতি
    const userPhone = customer.phone;
    const userName = customer.patientName;
    const doctorName = customer.doctorId?.name || "";
    const formattedAppointmentDate = author?.date
      ? moment(author.date).locale("bn").format("D MMMM, YYYY")
      : "";

    const enToBnNumber = (number) => {
      const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
      return number
        .toString()
        .split("")
        .map((d) => (/\d/.test(d) ? bnDigits[d] : d))
        .join("");
    };

    const getBanglaTimePeriod = (hour) => {
      if (hour >= 4 && hour < 12) return "সকাল";
      else if (hour >= 12 && hour < 15) return "দুপুর";
      else if (hour >= 15 && hour < 17) return "বিকাল";
      else if (hour >= 17 && hour < 19) return "সন্ধ্যা";
      else return "রাত";
    };

    const banglaSerial = serial ? enToBnNumber(serial) : "";

    let smsMessage = "";

    if (status === "confirmed") {
      // ✅ time যদি ISO string আসে (UTC)
      const dateObj = new Date(time); // UTC
      let localHour = dateObj.getUTCHours() + 6; // BST +6
      let localMinute = dateObj.getUTCMinutes();

      if (localHour >= 24) localHour -= 24; // next day adjustment

      const hour12 = localHour % 12 === 0 ? 12 : localHour % 12;
      const timePeriod = getBanglaTimePeriod(localHour);

      const formattedTime = `${enToBnNumber(hour12)}:${enToBnNumber(
        localMinute.toString().padStart(2, "0")
      )} ${timePeriod}`;

      smsMessage = `প্রিয় ${userName}, অভিনন্দন! আপনার অ্যাপয়েন্টমেন্ট ${doctorName} এর সঙ্গে নিশ্চিত করা হয়েছে।\nতারিখ: ${formattedAppointmentDate} সময়: ${formattedTime}${
        banglaSerial ? `\nসিরিয়াল নম্বর: ${banglaSerial}` : ""
      }\n- মেডি ফাস্ট হেলথ কেয়ার`;
    } else if (status === "cancelled") {
      smsMessage = `প্রিয় ${userName}, দুঃখিত! আপনার অ্যাপয়েন্টমেন্টটি বাতিল করা হয়েছে।\nডাক্তার: ${doctorName}\nতারিখ: ${formattedAppointmentDate}\n\n- মেডি ফাস্ট হেলথ কেয়ার`;
    }

    // ✅ SMS পাঠাও
    if (userPhone) {
      await sendSms(userPhone, smsMessage);
    }

    return responseReturn(res, 200, {
      message: "স্ট্যাটাস আপডেট হয়েছে এবং SMS পাঠানো হয়েছে।",
    });
  } catch (error) {
    console.log(error);
    return responseReturn(res, 500, { message: "server error" });
  }
};


const get_hospital_appoinments = async (req, res) => {
  const { hospitalId } = req.params;
  let { page = 1, parPage = 10, searchValue = "" } = req.query;

  page = parseInt(page);
  parPage = parseInt(parPage);
  const skipPage = parPage * (page - 1);

  try {
    const cacheKey = `hospital:${hospitalId}:appointments:page${page}:search:${searchValue}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return responseReturn(res, 200, JSON.parse(cached));
    }

    const matchStage = {
      hospitalId: new mongoose.Types.ObjectId(hospitalId),
    };

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "appoinments",
          localField: "appoinmentId",
          foreignField: "_id",
          as: "appoinment",
        },
      },
      { $unwind: "$appoinment" },
      {
        $lookup: {
          from: "doctors",
          localField: "doctorId",
          foreignField: "_id",
          as: "doctor",
        },
      },
      { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: true } },
    ];

    if (searchValue) {
      if (searchValue.match(/^[0-9a-fA-F]{24}$/)) {
        pipeline.push({
          $match: { _id: new mongoose.Types.ObjectId(searchValue) },
        });
      } else {
        pipeline.push({
          $match: {
            "appoinment.patientName": { $regex: searchValue, $options: "i" },
          },
        });
      }
    }

    pipeline.push(
      { $sort: { createdAt: -1 } },
      { $skip: skipPage },
      { $limit: parPage },
      {
        $project: {
          _id: 1,
          createdAt: 1,
          "appoinment.patientName": 1,
          "appoinment.category": 1,
          "appoinment.appointmentDate": 1,
          "appoinment.serial": 1,
          status: 1,
          "doctor.name": 1,
          "doctor.category": 1,
          isComplete: 1,
        },
      }
    );

    const appoinments = await authorAppoinmentModel.aggregate(pipeline);

    // total count
    const countPipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "appoinments",
          localField: "appoinmentId",
          foreignField: "_id",
          as: "appoinment",
        },
      },
      { $unwind: "$appoinment" },
    ];

    if (searchValue) {
      if (searchValue.match(/^[0-9a-fA-F]{24}$/)) {
        countPipeline.push({
          $match: { _id: new mongoose.Types.ObjectId(searchValue) },
        });
      } else {
        countPipeline.push({
          $match: {
            "appoinment.patientName": { $regex: searchValue, $options: "i" },
          },
        });
      }
    }

    countPipeline.push({ $count: "total" });

    const totalResult = await authorAppoinmentModel.aggregate(countPipeline);
    const totalAppoinments = totalResult[0]?.total || 0;

    const result = { appoinments, totalAppoinments };
    console.log(appoinments);
    // await redis.setex(cacheKey, 900, JSON.stringify(result)); // 15 min cache
    console.log(totalAppoinments);
    responseReturn(res, 200, result);
  } catch (error) {
    console.log(error);
    responseReturn(res, 500, { message: "server error" });
  }
};
const get_hospital_appoinment = async (req, res) => {
  const { appoinmentId } = req.params;
  try {
    const cacheKey = `hospital:appointment:${appoinmentId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return responseReturn(res, 200, JSON.parse(cached));
    }

    const appoinment = await authorAppoinmentModel
      .findById(appoinmentId)
      .populate("appoinmentId", "patientName appointmentDate serial ")
      .populate("doctorId", "name category")
      .populate("hospitalId", "name");

    if (!appoinment) {
      return responseReturn(res, 404, { message: "ডাটা পাওয়া যায়নি।" });
    }

    // await redis.setex(cacheKey, 900, JSON.stringify({ appoinment })); // cache 15 min
    responseReturn(res, 200, { appoinment });
  } catch (error) {
    console.log(error);
    responseReturn(res, 500, { message: "server error" });
  }
};

module.exports = {
  placeAppointment,
  get_appoinments,
  get_admin_appoinments,
  hospital_appoinment_status_update,
  get_hospital_appoinments,
  get_hospital_appoinment,
};
