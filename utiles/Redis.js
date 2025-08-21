const Redis = require("ioredis");
require("dotenv").config();

if (!process.env.REDIS_URL) {
  console.error("❌ Redis URL not found in env");
  process.exit(1);
}

const redis = new Redis(process.env.REDIS_URL, {
  tls: {}, // SSL connection secure করার জন্য এটা লাগবে upstash এ
  connectTimeout: 10000,
  maxRetriesPerRequest: 5,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on("connect", () => console.log("✅ Redis connected!"));
redis.on("error", (err) => console.error("❌ Redis error:", err));
redis.on("close", () => console.warn("⚠️ Redis closed"));

module.exports = redis;
