const formidable = require('formidable')
const cloudinary = require('cloudinary').v2
const { responseReturn } = require('../utiles/response')
const bannerModel = require('../models/bannerModel')
const { mongo: { ObjectId } } = require('mongoose')
const cron = require('node-cron');
const mongoose = require("mongoose")



const add_banner = async (req, res) => {
  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ message: "Form parse error" });

    const { validity } = fields;
    const { image } = files;

    if (!validity) {
      return res.status(400).json({ message: "Validity period is required" });
    }

    if (!image) {
      return res.status(400).json({ message: "Image is required" });
    }

    // Calculate expiry date
    let expiryDate = new Date();
    switch (validity) {
      case "1_month":
        expiryDate.setMonth(expiryDate.getMonth() + 1);
        break;
      case "3_months":
        expiryDate.setMonth(expiryDate.getMonth() + 3);
        break;
      case "6_months":
        expiryDate.setMonth(expiryDate.getMonth() + 6);
        break;
      case "1_year":
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        break;
      case "2_years":
        expiryDate.setFullYear(expiryDate.getFullYear() + 2);
        break;
      default:
        return res.status(400).json({ message: "Invalid validity period" });
    }

    cloudinary.config({
      cloud_name: process.env.cloud_name,
      api_key: process.env.api_key,
      api_secret: process.env.api_secret,
      secure: true,
    });

    try {
      // Upload image to Cloudinary
      const result = await cloudinary.uploader.upload(image.filepath, {
        folder: "banners",
      });

      // Save banner in DB
      const banner = await bannerModel.create({
        image: {
          url: result.secure_url,
          public_id: result.public_id,
        },
        validity,
        expiryDate,
      });

      return res.status(201).json({ banner, message: "Banner added successfully" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: error.message });
    }
  });
};




const get_banner = async (req, res) => {
  const { id } = req.params;
  console.log(id)
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return responseReturn(res, 400, { message: "Invalid banner ID" });
  }
  try {
    const banner = await bannerModel.findById(id);
    console.log("banner found:", banner);
    if (!banner) {
      return responseReturn(res, 404, { message: "Banner not found" });
    }

    responseReturn(res, 200, { banner });
  } catch (error) {
    console.error("Error fetching banner:", error);
    responseReturn(res, 500, { message: error.message || "Internal server error" });
  }
};

const  get_banners = async (req, res) => {

    try {
        const banners = await bannerModel.aggregate([
            {
                $sample: {
                    size: 10
                }
            }
        ])
        const totalBanner = await bannerModel.find({}).countDocuments()
        responseReturn(res, 200, { banners,totalBanner })
    } catch (error) {
        console.log(error)
        responseReturn(res, 500, { message: error.message })
    }
}

const update_banner = async (req, res) => {
    const { id } = req.params;
    const form = formidable({});

    form.parse(req, async (err, fields, files) => {
        if (err) {
            return responseReturn(res, 400, { message: "Form parse error" });
        }

        try {
            cloudinary.config({
                cloud_name: process.env.cloud_name,
                api_key: process.env.api_key,
                api_secret: process.env.api_secret,
                secure: true,
            });

            let banner = await bannerModel.findById(id);
            if (!banner) {
                return responseReturn(res, 404, { message: "Banner not found" });
            }

            if (files.image) {
                // পুরানো ছবি ডিলিট করার জন্য public_id ব্যবহার করা ভালো
                if (banner.image.public_id && banner.image.public_id !== "N/A") {
                    await cloudinary.uploader.destroy(banner.image.public_id);
                }

                // নতুন ছবি আপলোড
                const uploadResult = await cloudinary.uploader.upload(files.image.filepath, {
                    folder: "banners",
                });

                // ডাটাবেস আপডেট করুন
                banner.image.url = uploadResult.url;
                banner.image.public_id = uploadResult.public_id;
            }

            // যদি fields থেকে validity, expiryDate ইত্যাদি আপডেট করতে চান
            if (fields.validity) banner.validity = fields.validity;
            if (fields.expiryDate) banner.expiryDate = new Date(fields.expiryDate);

            await banner.save();

            responseReturn(res, 200, { banner, message: "Banner update success" });
        } catch (error) {
            console.log(error);
            responseReturn(res, 500, { message: error.message });
        }
    });
};

const delete_banner = async (req, res) => {
  const { id } = req.params;

  try {
    const banner = await bannerModel.findById(id);
    if (!banner) {
      return responseReturn(res, 404, { error: 'ব্যানার পাওয়া যায়নি।' });
    }

    // Cloudinary তে ইমেজ থাকলে ডিলিট করো
    if (banner.image?.public_id && banner.image.public_id !== 'N/A') {
      await cloudinary.uploader.destroy(banner.image.public_id);
    }

    // DB থেকে ডিলিট করো
    await bannerModel.deleteOne({ _id: id });

    // Cache ক্লিয়ার করো
    // if (typeof clearAllBannerCache === 'function') {
    //   await clearAllBannerCache();
    // }

    return responseReturn(res, 200, { message: 'ব্যানার সফলভাবে ডিলিট হয়েছে।' });

  } catch (error) {
    console.error('Delete banner error:', error.message);
    return responseReturn(res, 500, { error: 'সার্ভারে একটি ত্রুটি ঘটেছে।' });
  }
};



// cron.schedule('0 * * * *', async () => {
//   try {
//     const now = new Date();
//     const result = await bannerModel.deleteMany({ expiryDate: { $lte: now } });
//     console.log(`Expired banners deleted: ${result.deletedCount}`);
//   } catch (err) {
//     console.error('Error deleting expired banners:', err);
//   }
// });


module.exports = {add_banner,get_banner,update_banner, get_banners, delete_banner}