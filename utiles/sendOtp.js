const axios = require("axios");

const generateOtpWithoutZero = (length) => {
  const digits = '123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
};

const otpStore = new Map();

const sendOtp = async (phone) => {
  const otp = generateOtpWithoutZero(4); // ✅ ১-৯ পর্যন্ত OTP

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  otpStore.set(phone, { code: otp, expiresAt });

  const sms = `আপনার OTP কোড হলো: ${otp}`;

  const apiKey = "EGUpLTlFCED9aInNQPHC";
  const senderId = "8809617628543";

  const formattedPhone = phone.startsWith("0") ? "88" + phone : phone;

  const url = `http://bulksmsbd.net/api/smsapi?api_key=${apiKey}&senderid=${senderId}&number=${formattedPhone}&message=${encodeURIComponent(sms)}`;

  try {
    const response = await axios.get(url);
    console.log("📨 SMS API Response:", response.data);
  } catch (error) {
    console.error("❌ SMS পাঠাতে সমস্যা:", error.message);
    throw error;
  }

  return otp;
};

const getStoredOtp = (phone) => {
  return otpStore.get(phone);
};

const deleteStoredOtp = (phone) => {
  otpStore.delete(phone);
};

module.exports = {
  sendOtp,
  getStoredOtp,
  deleteStoredOtp,
};
