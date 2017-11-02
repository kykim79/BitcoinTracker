var redis = require('redis');

var format = require('string-format'); 
format.extend(String.prototype);

const CURRENCY = process.env.CURRENCY;

// LOGGER
var log4js = require('log4js');
var logger = log4js.getLogger('redisClient:' + CURRENCY.toLowerCase());

let option = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  retry_strategy: function(options) {
    logger.error('error: ' + option.error);
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

client.on('connect', () => {
  logger.warn('redis connected.');
});

client.on('end', () => {
  logger.warn('redis connection is closed.');
});

client.on('error', (err) => {
  logger.error('redis host: {REDIS_HOST}, redis port: {REDIS_PORT}'.format(process.env));
  logger.error(err);
});


module.exports = client;
