const redis = require("./Redis"); // তোমার redis config path

// ক্যাশ থেকে ডেটা নেয়া
const getCache = async (key) => {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};

// ক্যাশে ডেটা সেট করা
const setCache = async (key, value, expiry = 1200) => {
  await redis.set(key, JSON.stringify(value), "EX", expiry);
};

// ক্যাশ ডিলিট করা
const deleteCache = async (key) => {
  await redis.del(key);
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
};
