const categoryModel = require("../../models/categoryModel");
const doctorModel = require("../../models/doctorModel");
const hospitalModel = require("../../models/hospital.model")
const queryDoctors = require("../../utiles/queryDoctors");
const redis = require("../../utiles/Redis")
const contactModel = require("../../models/contact.model")
const moment = require("moment");
const mongoose = require("mongoose")
const {
  mongo: { ObjectId },
} = require("mongoose");

const { responseReturn } = require("../../utiles/response");
const userAmbulanceOrder = require("../../models/user.ambulance.order");
const userModel = require("../../models/userModel");


const formateProduct = (products) => {
  const doctorArray = [];
  let i = 0;
  while (i < products.length) {
    let temp = [];
    let j = i;
    while (j < i + 3) {
      if (products[j]) {
        temp.push(products[j]);
      }
      j++;
    }
    doctorArray.push([...temp]);
    i = j;
  }
  return doctorArray;
};

const get_categorys = async (req, res) => {
  try {
    // প্রথমে Redis cache থেকে ডেটা নেব
    const cachedCategorys = await redis.get("all_categories");

    if (cachedCategorys) {
      console.log("✅ Data from Redis cache");
      return res.status(200).json({
        categorys: JSON.parse(cachedCategorys),
      });
    }
    const categorys = await categoryModel.find({});  
    await redis.set("all_categories", JSON.stringify(categorys), "EX", 86400); 
    console.log("✅ Data from MongoDB and cached in Redis");
    return res.status(200).json({
      categorys,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      error: error.message,
    });
  }
};


const get_category = async (req, res) => {
  try {
   
    const cachedCategory = await redis.get("categories_homepage");

    if (cachedCategory) {
    
      console.log("✅ Data from Redis cache");
      return res.status(200).json({
        category: JSON.parse(cachedCategory),
      });
    }   
    const category = await categoryModel.find({}).limit(6);
    await redis.set("categories_homepage", JSON.stringify(category), "EX", 86400);  
    console.log("✅ Data from MongoDB and cached in Redis");
    return res.status(200).json({
      category,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      error: error.message,
    });
  }
};





const get_doctors = async (req, res) => {
  try {
    const {
      division = "",
      district = "",
      upazila = "",
      hospital = "",
      search = "",
      category = "",          // category যুক্ত হল
      page = 1,
      perPage = 20,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(perPage);

    let userUpazila = "";
    if (req.user?.id) {
      const user = await userModel.findById(req.user.id);
      userUpazila = user?.upazila || "";
    }
    console.log(userUpazila,"userUpazila")
    const finalUpazila = upazila || userUpazila;

    const hospitalFilter = {};
    if (district) hospitalFilter.district = district;
    if (finalUpazila) hospitalFilter.upazila = finalUpazila;

    const hospitalIds = await hospitalModel.find(hospitalFilter).distinct("_id");

    const matchConditions = {};
    if (search) matchConditions.$text = { $search: search };

    if (category) {
      matchConditions.category = category;  // <-- category ফিল্টার যুক্ত হল
    }

    if (hospital) {
      matchConditions.hospitalId = new mongoose.Types.ObjectId(hospital);
    } else if (hospitalIds.length > 0) {
      matchConditions.hospitalId = { $in: hospitalIds };
    } else {
      matchConditions.hospitalId = { $exists: false };
    }

    // Cache key তে category যোগ করো যেন ক্যাশ ভ্যালিড হয় ক্যাটেগরি অনুযায়ী
    const cacheKey = `doctors:${division}:${district}:${finalUpazila}:${hospital}:${category}:${search}:${page}:${perPage}:${req.user?.id || "guest"}`;

    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

    const pipeline = [
      { $match: matchConditions },
      { $sort: { createdAt: -1 } },
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
        $project: {
          name: 1,
          category: 1,
          fee: 1,
          description: 1,
          image: 1,
          qualification: 1,
          experience: 1,
          slots: 1,
          hospital: { name: "$hospital.name" },
          hospitalId: 1,
          createdAt: 1,
        },
      },
    ];

    const doctors = await doctorModel.aggregate(pipeline);

    // hospital অনুযায়ী গ্রুপিং
    const doctorsByHospital = {};
    for (const doctor of doctors) {
      const hid = doctor.hospitalId.toString();
      if (!doctorsByHospital[hid]) doctorsByHospital[hid] = [];
      doctorsByHospital[hid].push(doctor);
    }

    // round-robin সাজানো
    const finalDoctors = [];
    let moreData = true;
    while (moreData) {
      moreData = false;
      for (const hid of Object.keys(doctorsByHospital)) {
        if (doctorsByHospital[hid].length > 0) {
          finalDoctors.push(doctorsByHospital[hid].shift());
          moreData = true;
        }
      }
    }

    const paginatedDoctors = finalDoctors.slice(skip, skip + parseInt(perPage));

    const responseData = {
      doctors: paginatedDoctors,
      totalDoctors: finalDoctors.length,
      currentPage: parseInt(page),
      perPage: parseInt(perPage),
      totalPage: Math.ceil(finalDoctors.length / perPage),
    };

    await redis.set(cacheKey, JSON.stringify(responseData), "EX", 900);

    res.status(200).json(responseData);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};









const get_doctor = async (req, res) => {
  const { id } = req.params;
  console.log(id, "id");
  try {
    const doctor = await doctorModel
      .findById(id).populate("hospitalId");
      console.log(doctor)
    responseReturn(res, 200, {
      doctor,
     
    });
  } catch (error) {
    responseReturn(res, 500, { error: error.message });
  }
};

const query_doctors = async (req, res) => {
  const parPage = parseInt(req.query.parPage) || 20;
  const pageNumber = parseInt(req.query.pageNumber) || 1;
  const skip = (pageNumber - 1) * parPage;
  const { category, searchValue } = req.query;

  let queryObj = {};

  // Category (case-insensitive exact match)
  if (category) {
    queryObj.category = { $regex: `^${category.trim()}$`, $options: "i" };
  }

  // Search (name partial match)
  if (searchValue) {
    queryObj.name = { $regex: searchValue, $options: "i" };
  }

  try {
    const totalDoctor = await doctorModel.countDocuments(queryObj);

    const doctors = await doctorModel
      .find(queryObj)
      .select(
        "name category fee description image qualification experience slots hospitalId"
      )
      .populate("hospitalId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parPage);
      const modifiedDoctors = doctors.map((doctor) => {
        const doc = doctor.toObject(); // Mongoose doc কে plain JS object বানাচ্ছি
        doc.hospital = doc.hospitalId;
        delete doc.hospitalId;
        return doc;
      });
      
    console.log(modifiedDoctors);

    responseReturn(res, 200, {
      doctors: modifiedDoctors,
      totalDoctor,
      parPage,
    });
  } catch (error) {
    responseReturn(res, 500, { error: error.message });
  }
};


// create contact us
const createContact = async (req, res) => {
  const {name, phone,message} = req.body;
  console.log(req.body)
  try {
    const contact = await contactModel.create({
      name, phone,message
    })
    responseReturn(res, 200, {
      contact, message :"আপনার যোগাযোগ সফলভাবে সংরক্ষিত হয়েছে। ধন্যবাদ!"
    });
  } catch (error) {
    console.log(error)
    responseReturn(res, 500, { error: error.message,   message: 'কিছু ত্রুটি ঘটেছে, পরে আবার চেষ্টা করুন।', });
  }
};
// 

// sudu matro hospital name show korar jnno
const getHospitals = async (req, res) => {
  try {
    const {
      division = "",
      district = "",
      upazila = "",
      search = "",      // search param নেয়া
      page = 1,
      perPage = 20,
    } = req.query;

    // ইউজারের upazila নেওয়া (যদি লগইন থাকে)
    let userUpazila = "";
    if (req.user?.id) {
      const user = await userModel.findById(req.user.id);
      userUpazila = user?.upazila || "";
    }

    // final upazila হবে query param না দিলে ইউজারের upazila
    const finalUpazila = upazila || userUpazila;

    // Hospital filter তৈরি
    const hospitalFilter = { status: "active" }; // ✅ শুধু active hospital

    if (division) hospitalFilter.division = division;
    if (district) hospitalFilter.district = district;
    if (finalUpazila) hospitalFilter.upazila = finalUpazila;

    // search যদি থাকে, hospital name এর উপর regex সার্চ যোগ করো
    if (search) {
      hospitalFilter.name = { $regex: search, $options: "i" }; // case-insensitive search
    }

    const skip = (parseInt(page) - 1) * parseInt(perPage);

    // Hospital গুলো খুঁজে বের করা pagination সহ
    const hospitals = await hospitalModel
      .find(hospitalFilter)
      .select("_id name division district upazila image address phone type")
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(perPage));

    // মোট হাসপাতালের সংখ্যা pagination এর জন্য
    const totalHospitals = await hospitalModel.countDocuments(hospitalFilter);

    res.status(200).json({
      hospitals,
      totalHospitals,
      currentPage: parseInt(page),
      perPage: parseInt(perPage),
      totalPages: Math.ceil(totalHospitals / perPage),
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};




const getDoctorsByHospital = async (req, res) => {
  const { hospitalId } = req.params;
  console.log("✅ Request Param:", hospitalId);

  try {
    const doctors = await doctorModel
      .find({ hospitalId })
      .select({
        name: 1,
        category: 1,
        fee: 1,
        description: 1,
        image: 1,
        qualification: 1,
        experience: 1,
        slots: 1,
        hospitalId: 1, 
      })
      .populate("hospitalId", "name");

    if (doctors.length === 0) {
      return responseReturn(res, 404, {
        message: "এই হাসপাতালে কোনো ডাক্তার পাওয়া যায়নি।",
      });
    }

    // hospitalId কে hospital নাম দিয়ে সাজানো
    const formattedDoctors = doctors.map((doc) => {
      const { hospitalId, ...rest } = doc._doc;
      return {
        ...rest,
            hospitalId: hospitalId?._id, // এখানে id পাঠানো হচ্ছে
        hospital: hospitalId ? { name: hospitalId.name } : null,
      };
    });
    console.log(formattedDoctors,"formattedDoctors")
    responseReturn(res, 200, {
      doctors: formattedDoctors,
      message: "ডাক্তার লিস্ট সফলভাবে পাওয়া গেছে।",
    });
  } catch (error) {
    console.log(error);
    responseReturn(res, 500, {
      error: error.message,
      message: "কিছু ত্রুটি ঘটেছে, পরে আবার চেষ্টা করুন।",
    });
  }
};

const convertToEnglishNumber = (input) => {
  if (!input) return "";
  const banglaNums = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
  const engNums = ['0','1','2','3','4','5','6','7','8','9'];
  let output = input;
  banglaNums.forEach((bn, i) => {
    const regex = new RegExp(bn, 'g');
    output = output.replace(regex, engNums[i]);
  });
  return output;
};

const placeAmbulanceBooking = async (req, res) => {
  const {
    userId,
    name,
    phone,
    pickupDate,
    pickupTime,
    pickupAddress,
    dropAddress,
    age,
    ambulanceType
    
  } = req.body;

  try {
    // pickupDate validation & parse
    if (!pickupDate) {
      return res.status(400).json({ message: "পিকআপের তারিখ দিতে হবে।" });
    }

    // বাংলা সংখ্যা ইংরেজিতে convert করা
    const engDate = convertToEnglishNumber(pickupDate);

    // date split করা (DD-MM-YYYY ধরে)
    const [day, month, year] = engDate.split("-");
    if (!day || !month || !year) {
      return res.status(400).json({ message: "অবৈধ পিকআপ তারিখ।" });
    }

    const parsedDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "অবৈধ পিকআপ তারিখ।" });
    }

    const convertedPhone = convertToEnglishNumber(phone);

    // আগের pending booking check
    const existingPendingBooking = await userAmbulanceOrder.findOne({
      userId,
      status: "pending",
    });

    if (existingPendingBooking) {
      return res.status(400).json({
        message: "আপনার পূর্বের একটি অ্যাম্বুলেন্স বুকিং এখনও pending আছে।",
      });
    }

    // নতুন অ্যাম্বুলেন্স বুকিং তৈরি
    const booking = await userAmbulanceOrder.create({
      userId,
       name,
      phone: convertedPhone,
      pickupDate: parsedDate,
      pickupTime,
      pickupAddress,
      dropAddress,
      age,
      status: "pending",
      ambulanceType
    });

    

    res.status(201).json({
      message: "অ্যাম্বুলেন্স বুক করা হয়েছে সফলভাবে",
      bookingId: booking._id,
      bookingTime: moment(booking.createdAt).format("LLL"),
    });

  } catch (error) {
    console.log("Error in placeAmbulanceBooking:", error.message);
    res.status(500).json({ message: "অ্যাম্বুলেন্স বুক করা যায়নি" });
  }
};


const get_ambulances = async (req, res) => {
  const { userId, status } = req.params;


  let { page, parPage } = req.query;

  page = parseInt(page) || 1;
  parPage = parseInt(parPage) || 10;
  const skipPage = parPage * (page - 1);

  try {
    let ambulances = [];
    let totalAmbulance = 0;

    if (status !== "all") {
      totalAmbulance = await userAmbulanceOrder.countDocuments({
        userId: new ObjectId(userId),
        status: status,
      });

      ambulances = await userAmbulanceOrder.find({
        userId: new ObjectId(userId),
        status: status,
      })
        .sort({ createdAt: -1 })
        .skip(skipPage)
        .limit(parPage);
    } else {
      totalAmbulance = await userAmbulanceOrder.countDocuments({
        userId: new ObjectId(userId),
      });

      ambulances = await userAmbulanceOrder.find({
        userId: new ObjectId(userId),
      })
        .sort({ createdAt: -1 })
        .skip(skipPage)
        .limit(parPage);
    }

    responseReturn(res, 200, {
      message: "অ্যাম্বুলেন্স বুকিং লোড হয়েছে।",
      ambulances,
      totalAmbulance,
    });
  } catch (error) {
    console.log(error);
    responseReturn(res, 500, { message: "internal server error" });
  }
};


// get all hospital  image

const getAllHospitals = async (req, res) => {
  try {
    const {
      page = 1,
      perPage = 10, // প্রতি কল-এ 10টি hospital
      division = "",
      district = "",
      upazila = ""
    } = req.query;

    // ইউজারের upazila নেওয়া (যদি লগইন থাকে)
    let userUpazila = "";
    if (req.user?.id) {
      const user = await userModel.findById(req.user.id).select("upazila");
      userUpazila = user?.upazila || "";
    }

    // Final upazila হবে query param না দিলে ইউজারের upazila
    const finalUpazila = upazila || userUpazila;

    // Filter তৈরি
    const hospitalFilter = { status: "active" };
    if (division) hospitalFilter.division = division;
    if (district) hospitalFilter.district = district;
    if (finalUpazila) hospitalFilter.upazila = finalUpazila;

    const skip = (parseInt(page) - 1) * parseInt(perPage);

    // Hospital থেকে শুধু image field আনা + random order
    const hospitals = await hospitalModel.aggregate([
      { $match: hospitalFilter },
      { $sample: { size: parseInt(perPage) } }, // random 10টি data
      { $project: { _id: 1, image: 1 } } // শুধু image field
    ]);

    res.status(200).json({
      hospitals,
      currentPage: parseInt(page),
      perPage: parseInt(perPage),
      totalFetched: hospitals.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};



module.exports = {
  query_doctors,
  get_doctor,
  get_categorys,
  get_category,
  get_doctors,
  formateProduct,
  createContact,getHospitals,getDoctorsByHospital,placeAmbulanceBooking,get_ambulances,getAllHospitals
};
