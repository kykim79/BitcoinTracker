var redis = require("redis");

var redisConfig = require("./config/redisConfig")

// LOGGER
var log4js = require('log4js');
var logger = log4js.getLogger('redisClient');

var option = {
  host: redisConfig.host,
  port: redisConfig.port,
  retry_strategy: function(options) {
    logger.error('error: ' + option.error + ', error.code: ' + options.error.code);
    if (options.total_retry_time > 1000 * 60 * 60) {
      // End reconnecting after a specific timeout and flush all commands 
      // with a individual error 
      return new Error('Retry time exhausted');
    }
    // reconnect after 
    return 5000;
  }
};

var client = redis.createClient(option);

client.on("connect", () => {
  logger.warn("redis connected.");
});

client.on("end", () => {
  logger.warn("redis connection is closed.");
});

client.on("error", (err) => {
  logger.error(err);
});


module.exports = client;