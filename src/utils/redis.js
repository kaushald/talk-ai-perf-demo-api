const redis = require('redis');

let client = null;

async function initRedis() {
  if (client) {
    return client;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  client = redis.createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          return new Error('Redis reconnection limit exceeded');
        }
        return Math.min(retries * 100, 3000);
      }
    }
  });

  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  client.on('connect', () => {
    console.log('Redis Client Connected');
  });

  await client.connect();
  
  return client;
}

async function getRedisClient() {
  if (!client) {
    await initRedis();
  }
  return client;
}

module.exports = {
  initRedis,
  getRedisClient
};