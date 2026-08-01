const Redis = require("ioredis");
require("dotenv").config();

const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
  username: process.env.REDIS_USERNAME || undefined,
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB || 0),
};

const redis = new Redis(redisConfig);

redis.on("connect", () => {
  console.log("✅ Connected to Redis");
});

redis.on("error", (error) => {
  console.error("❌ Redis connection error:", error.message || error);
});

module.exports = redis;
