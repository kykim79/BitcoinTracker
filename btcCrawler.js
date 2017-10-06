var syncRequest = require('sync-request');

require('moment-timezone');

var CoinInfo = require('./coinInfo.js');
var CronJob = require('cron').CronJob;

const BITHUMB_CURRENCY = 'BTC';
const BITHUMB_URL = "https://api.bithumb.com/public/recent_transactions/" + BITHUMB_CURRENCY;

const TIMEZONE = 'Asia/Seoul';

// LOGGER
var log4js = require('log4js');
log4js.configure('./config/loggerConfig.json');
var log4js_extend = require("log4js-extend");
log4js_extend(log4js, {
  path: __dirname,
  format: "(@name:@line:@column)"
});

var logger = log4js.getLogger('crawler');

// CONFIG
const CRON = 'cron';
const MAX_COUNT = 'maxCount';
const ConfigWatch = require("config-watch");
const CONFIG_FILE = './config/crawlerConfig.json';
let configWatch = new ConfigWatch(CONFIG_FILE);

let cronSchedule = configWatch.get(CRON);
let maxCount = configWatch.get(MAX_COUNT);


var cronJob;
configWatch.on("change", (err, config) => { // great !! 
  try {
    if (err) { throw err; }
    
    if(config.hasChanged(CRON)) {
      cronSchedule = config.get(CRON);
      cronJob.time = cronSchedule;
      logger.warn("cronSchedule has been changed to " + cronJob.time);
    }
    
    if(config.hasChanged(MAX_COUNT)) {
      maxCount = config.get(MAX_COUNT);
      logger.warn("maxcount has been changed to " + maxCount);
    }
  } catch (exception) {
    logger.error(exception);
  }
});

var redisClient = require("./redisClient.js");

var resize = (max) => {
  redisClient.zcard(BITHUMB_CURRENCY, (err, res) => {
    if(err) {
      logger.error(err);
    }
    if(res > max) {
      redisClient.zremrangebyrank(BITHUMB_CURRENCY, 0, res - max - 1);
    }
  });
};

let lastepoch = 0;
const TEN_MINUTE = 600;

var heartbeat = (coinInfo) => {
  const epoch = Math.round(Date.now() / 1000);
  if (epoch - lastepoch > TEN_MINUTE) {
    lastepoch = epoch;
    logger.debug("crawler is running. cron: " + cronSchedule + ", coinInfo: "+ coinInfo.toString());
  } 
};

var crawl = () => {
  try {    
    var res = syncRequest('GET', BITHUMB_URL);
    const coinInfo = new CoinInfo(JSON.parse(res.getBody()));
    redisClient.zadd(BITHUMB_CURRENCY, coinInfo.epoch, JSON.stringify(coinInfo));
    resize(maxCount);
    heartbeat(coinInfo);
  } catch (exception) {
    logger.error("[crawl] exception: " + exception);
  }    
};

cronJob = new CronJob(cronSchedule, crawl, null, true, TIMEZONE);
