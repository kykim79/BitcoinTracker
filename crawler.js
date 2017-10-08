var syncRequest = require('sync-request');

var momnent = require('moment');
var Map = require('hashmap');

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

// Stream Roller
var rollers = require('streamroller');
var stream = new rollers.RollingFileStream('./log/crawler.log', 100000, 2);


// var events = require('events');
// var emitter = new events.EventEmitter();
// exports.getEmitter = () => emitter;

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
    if(err) { throw err; }
    if(res > max) {
      redisClient.zremrangebyrank(BITHUMB_CURRENCY, 0, res - max - 1);
    }
  });
};

let lastepoch = 0;
const TEN_MINUTE = 600;

var heartbeat = () => {
  const epoch = Math.round(Date.now() / 1000);
  if (epoch - lastepoch > TEN_MINUTE) {
    lastepoch = epoch;
    logger.debug("crawler is running. cron: " + cronSchedule);
  } 
};

var writtenKeys = [];
var isFirst = true;

var crawl = () => {
  try {    
    
    var content = JSON.parse(syncRequest('GET', BITHUMB_URL).getBody());

    var coinMap = new Map();    
    content.data.forEach(e => {
      const minKey = momnent(new Date(e.transaction_date)).second(0).milliseconds(0).unix();
      if(coinMap.has(minKey)){
        coinMap.get(minKey).push(e);
      } else {
        coinMap.set(minKey, [e]);
      }
    });

    var coins = [];    
    coins = coinMap.keys();
    coins.sort();
    if(isFirst) {
      coins.shift();
      isFirst = false;
    } else {
      writtenKeys = writtenKeys.filter(e => e >= coins[0]);
      coins = coins.filter(e => !writtenKeys.includes(e));
    } 
    
    coins.pop();
    coins.forEach(e => {
      const t = coinMap.get(e);
      const coinInfo = new CoinInfo(t);
      if(coinInfo.volume != 0 && coinInfo.price != null) {
        redisClient.zadd(BITHUMB_CURRENCY, coinInfo.epoch, JSON.stringify(coinInfo));
        writtenKeys.push(momnent(new Date(coinInfo.epoch)).second(0).milliseconds(0).unix());
        
        writeLog(t, coinInfo);
      }       
    });
    
    resize(maxCount);
    heartbeat();
  } catch (exception) {
    logger.error("[crawl] exception: " + exception);
  }    
};

cronJob = new CronJob(cronSchedule, crawl, null, true, TIMEZONE);

function writeLog(transactions, coinInfo) {
  try {
    stream.write(coinInfo.toString() + " " + JSON.stringify(transactions) + require('os').EOL);
  } catch (exception) {
    logger.error(exception);
  }
    
}