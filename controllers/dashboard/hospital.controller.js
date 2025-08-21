const hospitalModel = require("../../models/hospital.model");
const { responseReturn } = require("../../utiles/response");
const redis = require("../../utiles/Redis");

// Utility function to clear hospital related cache keys
const clearHospitalCaches = async () => {
  const keys = await redis.keys("*hospital*");
  if (keys.length > 0) {
    await redis.del(keys);
  }
};

// get hospital request
const get_hospital_request = async (req, res) => {
  try {
    const { page = 1, parPage = 10, searchValue = "" } = req.query;
    const pageNum = parseInt(page);
    const perPageNum = parseInt(parPage);
    const skipPage = perPageNum * (pageNum - 1);

    if (isNaN(pageNum) || isNaN(perPageNum) || pageNum < 1 || perPageNum < 1) {
      return responseReturn(res, 400, { error: "পেজ নাম্বার বা পার পেজ সংখ্যা সঠিক নয়।" });
    }

    const query = { status: "pending" };
    if (searchValue.trim()) {
      query["$or"] = [
        { name: { $regex: searchValue, $options: "i" } },
        { phone: { $regex: searchValue, $options: "i" } },
        { email: { $regex: searchValue, $options: "i" } },
      ];
    }

    const cacheKey = `pending_hospital_requests_${pageNum}_${perPageNum}_${searchValue.trim() ? "search" : "all"}`;

    if (!searchValue.trim()) {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        return responseReturn(res, 200, JSON.parse(cachedData));
      }
    }

    const [hospitals, totalHospital] = await Promise.all([
      hospitalModel.find(query).skip(skipPage).limit(perPageNum).sort({ createdAt: -1 }).lean(),
      hospitalModel.countDocuments(query),
    ]);

    const resultData = { totalHospital, hospitals };

    if (!searchValue.trim()) {
      await redis.set(cacheKey, JSON.stringify(resultData), "EX", 60 * 15);
    }

    return responseReturn(res, 200, resultData);

  } catch (error) {
    console.error("হাসপাতাল রিকুয়েস্ট লোডিং সমস্যা:", error);
    return responseReturn(res, 500, { error: "ভাই, সার্ভারে সমস্যা হয়েছে।" });
  }
};

// hospital status update
const hospital_status_update = async (req, res) => {
  const { hospitalId, status } = req.body;

  try {
    await hospitalModel.findByIdAndUpdate(hospitalId, { status });
    const hospital = await hospitalModel.findById(hospitalId);

    // Clear all hospital related caches
    await clearHospitalCaches();

    responseReturn(res, 200, {
      hospital,
      message: "হাসপাতাল স্ট্যাটাস সফলভাবে আপডেট হয়েছে।",
    });

  } catch (error) {
    console.error("Status update error:", error);
    responseReturn(res, 500, { error: error.message });
  }
};

// get active hospitals
const get_active_hospitals = async (req, res) => {
  let { page, searchValue, parPage } = req.query;
  page = parseInt(page);
  parPage = parseInt(parPage);
  const skipPage = parPage * (page - 1);

  try {
    const cacheKey = searchValue
      ? `active_hospitals_search:${searchValue}:${page}:${parPage}`
      : `active_hospitals:${page}:${parPage}`;

    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return responseReturn(res, 200, JSON.parse(cachedData));
    }

    const query = { status: "active" };
    if (searchValue) query["$text"] = { $search: searchValue };

    const [hospitals, totalHospital] = await Promise.all([
      hospitalModel.find(query).skip(skipPage).limit(parPage).sort({ createdAt: -1 }),
      hospitalModel.countDocuments(query),
    ]);

    await redis.set(cacheKey, JSON.stringify({ totalHospital, hospitals }), "EX", 60 * 30);
    console.log(totalHospital,"totalHospital")
    responseReturn(res, 200, { totalHospital, hospitals });

  } catch (error) {
    console.error("Active hospitals fetch error:", error);
    responseReturn(res, 500, { error: error.message });
  }
};

// get deactive hospitals
const get_deactive_hospitals = async (req, res) => {
  let { page, searchValue, parPage } = req.query;
  page = parseInt(page);
  parPage = parseInt(parPage);
  const skipPage = parPage * (page - 1);

  try {
    const cacheKey = searchValue
      ? `deactive_hospitals_search:${searchValue}:${page}:${parPage}`
      : `deactive_hospitals:${page}:${parPage}`;

    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return responseReturn(res, 200, JSON.parse(cachedData));
    }

    const query = { status: "deactive" };
    if (searchValue) query["$text"] = { $search: searchValue };

    const [hospitals, totalHospital] = await Promise.all([
      hospitalModel.find(query).skip(skipPage).limit(parPage).sort({ createdAt: -1 }),
      hospitalModel.countDocuments(query),
    ]);

    await redis.set(cacheKey, JSON.stringify({ totalHospital, hospitals }), "EX", 60 * 30);

    responseReturn(res, 200, { totalHospital, hospitals });

  } catch (error) {
    console.error("Deactive hospitals fetch error:", error);
    responseReturn(res, 500, { error: error.message });
  }
};

// Query hospitals by division/district/upazila
const query_hospitals = async (req, res) => {
  let { page, parPage, division = "", district = "", upazila = "" } = req.query;
  page = parseInt(page);
  parPage = parseInt(parPage);
  const skip = (page - 1) * parPage;

  const filterQuery = { status: "active" };
  if (division) filterQuery.division = division;
  if (district) filterQuery.district = district;
  if (upazila) filterQuery.upazila = upazila;

  try {
    const [hospitals, totalHospital] = await Promise.all([
      hospitalModel.find(filterQuery).skip(skip).limit(parPage).sort({ createdAt: -1 }),
      hospitalModel.countDocuments(filterQuery),
    ]);

    responseReturn(res, 200, { totalHospital, hospitals });

  } catch (error) {
    responseReturn(res, 500, { error: error.message });
  }
};

// get hospital by id
const get_hospital = async (req, res) => {
  const { hospitalId } = req.params;
  try {
    const hospital = await hospitalModel.findById(hospitalId);
    responseReturn(res, 200, { hospital });
  } catch (error) {
    responseReturn(res, 500, { error: error.message });
  }
};

module.exports = {
  get_hospital_request,
  get_hospital,
  hospital_status_update,
  get_active_hospitals,
  get_deactive_hospitals,
  query_hospitals,
};
