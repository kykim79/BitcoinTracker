const syncRequest = require('sync-request');

var momnent = require('moment');
var Map = require('hashmap');

var CoinInfo = require('./coinInfo.js');
var CronJob = require('cron').CronJob;

// CONFIG
const ConfigWatch = require("config-watch");
const CONFIG_FILE = './config/crawlerConfig.json';
const configWatch = new ConfigWatch(CONFIG_FILE);

const CURRENCY = configWatch.get('currency');
const CRON_SCHEDULE = configWatch.get('cron');
const MAX_COUNT = configWatch.get('maxCount');

const TIMEZONE = 'Asia/Seoul';

// LOGGER
var log4js = require('log4js');
log4js.configure('./config/loggerConfig.json');
var log4js_extend = require("log4js-extend");
log4js_extend(log4js, {
  path: __dirname,
  format: "(@name:@line:@column)"
});

var logger = log4js.getLogger('crawler:' + CURRENCY.toLowerCase());

const BITHUMB_URL = "https://api.bithumb.com/public/recent_transactions/" + CURRENCY;

// Stream Roller
var rollers = require('streamroller');
var stream = new rollers.RollingFileStream('./log/crawler.log', 100000, 2);

var redisClient = require("./redisClient.js");

var resize = (max) => {
  redisClient.zcard(CURRENCY, (err, res) => {
    if(err) { throw err; }
    if(res > max) {
      redisClient.zremrangebyrank(CURRENCY, 0, res - max - 1);
    }
  });
};

let lastepoch = 0;
const TWENTY_MINUTE = 1200;

var heartbeat = () => {
  const epoch = Math.round(Date.now() / 1000);
  if (epoch - lastepoch > TWENTY_MINUTE) {
    lastepoch = epoch;
    logger.debug("crawler is running. cron: " + CRON_SCHEDULE);
  } 
};

var writtenKeys = [];
var isFirst = true;

var Promise = require("bluebird");
var bhttp = require("bhttp");

var crawl = () => {
  Promise.try(() => { 
    return bhttp.get(BITHUMB_URL); 
  }).then((response) => {
    var content = JSON.parse(response.body);
    grouping(content);	
    resize(MAX_COUNT);
    heartbeat();      
  }).catch((e) => {
    logger.error(e);
  });
};

function grouping(content) {
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
      redisClient.zadd(CURRENCY, coinInfo.epoch, JSON.stringify(coinInfo));
      writtenKeys.push(momnent(new Date(coinInfo.epoch)).second(0).milliseconds(0).unix());
      writeLog(t, coinInfo);
    }
  });  
}

new CronJob(CRON_SCHEDULE, crawl, null, true, TIMEZONE);

function writeLog(transactions, coinInfo) {
  try {
    stream.write(coinInfo.toString() + " " + JSON.stringify(transactions) + require('os').EOL);
  } catch (e) {
    logger.error(e);
  }
    
}