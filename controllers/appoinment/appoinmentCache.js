const redis = require("../../utiles/Redis");

// সব ইউজার ক্যাশ ডিলিট
// const clearUserAppointmentsCache = async (userId) => {
//   const keys = await redis.keys(`user:${userId}:appointments:*`);
//   if (keys.length > 0) {
//     await redis.del(keys);
//   }
// };

// // সব অ্যাডমিন ক্যাশ ডিলিট
// const clearAdminAppointmentsCache = async () => {
//   const keys = await redis.keys(`admin:appointments*`);
//   if (keys.length > 0) {
//     await redis.del(keys);
//   }
// };

// // নির্দিষ্ট হাসপাতালের ক্যাশ ডিলিট
// const clearHospitalAppointmentsCache = async (hospitalId) => {
//   const keys = await redis.keys(`hospital:${hospitalId}:appointments*`);
//   if (keys.length > 0) {
//     await redis.del(keys);
//   }
// };

// // নির্দিষ্ট অ্যাপয়েন্টমেন্ট ক্যাশ ডিলিট
// const clearSingleAppointmentCache = async (appointmentId) => {
//   await redis.del(`hospital:appointment:${appointmentId}`);
// };

// module.exports = {
//   clearUserAppointmentsCache,
//   clearAdminAppointmentsCache,
//   clearHospitalAppointmentsCache,
//   clearSingleAppointmentCache,
// };




// Admin appointments
const clearAdminAppointmentsCache = async () => {
  const keys = await redis.keys("admin:appointments:*");
  if (keys.length) await redis.del(...keys);
};

// User appointments
const clearUserAppointmentsCache = async (userId) => {
  const keys = await redis.keys(`user:${userId}:appointments:*`);
  if (keys.length) await redis.del(...keys);
};

// Hospital appointments list
const clearHospitalAppointmentsCache = async (hospitalId) => {
  const keys = await redis.keys(`hospital:${hospitalId}:appointments:*`);
  if (keys.length) await redis.del(...keys);
};

// Single appointment details
const clearSingleAppointmentCache = async (appointmentId) => {
  const key = `hospital:appointment:${appointmentId}`;
  await redis.del(key);
};

module.exports = {
  clearAdminAppointmentsCache,
  clearUserAppointmentsCache,
  clearHospitalAppointmentsCache,
  clearSingleAppointmentCache,
};

