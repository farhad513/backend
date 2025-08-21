const axios = require("axios");

const sendSms = async (phone, message) => {
  const apiKey = "EGUpLTlFCED9aInNQPHC";
  const senderId = "8809617628543";
  const formattedPhone = phone.startsWith("0") ? "88" + phone : phone;

  const url = `http://bulksmsbd.net/api/smsapi?api_key=${apiKey}&senderid=${senderId}&number=${formattedPhone}&message=${encodeURIComponent(message)}`;

  try {
    const response = await axios.get(url);
    console.log("📨 SMS Sent:", response.data);
  } catch (error) {
    console.error("❌ SMS Error:", error.message);
  }
};

module.exports = { sendSms };
