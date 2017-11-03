var moment = require('moment');
var Map = require('hashmap');

var CoinInfo = require('./coinInfo.js');
var CronJob = require('cron').CronJob;

String.prototype.unquoted = function (){return this.replace (/(^")|("$)/g, '');};

const CURRENCY = process.env.CURRENCY;
const CRON_SCHEDULE = process.env.CRAWLER_CRON.unquoted();
const MAX_COUNT = process.env.MAX_COUNT;

const TIMEZONE = 'Asia/Seoul';

// LOGGER
var log4js = require('log4js');
log4js.configure(process.env.LOGGER_CONFIG);
var log4js_extend = require('log4js-extend');
log4js_extend(log4js, {
  path: __dirname,
  format: '(@name:@line:@column)'
});

var logger = log4js.getLogger('crawler:' + CURRENCY.toLowerCase());

const BITHUMB_URL = 'https://api.bithumb.com/public/recent_transactions/' + CURRENCY;

// Stream Roller
var rollers = require('streamroller');
var stream = new rollers.RollingFileStream('./log/crawler.log', 100000, 2);
var stream2 = new rollers.RollingFileStream('./log/raw.log', 100000, 2);

var redisClient = require('./redisClient.js');

String.prototype.unquoted = function (){return this.replace (/(^")|("$)/g, '');};

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
    logger.debug('running. cron: ' + CRON_SCHEDULE);
  } 
};

var writtenKeys = [];
var isFirst = true;

var Promise = require('bluebird');
var bhttp = require('bhttp');

var crawl = () => {
  Promise.try(() => { 
    return bhttp.get(BITHUMB_URL); 
  }).then((response) => {
    write(getNewCoins(response.body));	
    resize(MAX_COUNT);
  }).catch((e) => {
    logger.error(e);
  });
  
  heartbeat();
};

function getNewCoins(body) {
  writeLog2(body);
  
  var coinMap = new Map();
  body.data.forEach(e => {
    const minuteKey = moment(new Date(e.transaction_date)).second(0).milliseconds(0).unix();
    if(coinMap.has(minuteKey)){
      coinMap.get(minuteKey).push(e);
    } else {
      coinMap.set(minuteKey, [e]);
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
  return coins.map(e => coinMap.get(e));
}

function write(newCoins) {
  newCoins.forEach(e => {
    const coinInfo = new CoinInfo(e);
    if(coinInfo.volume != 0 && coinInfo.price != null) {
      redisClient.zadd(CURRENCY, coinInfo.epoch, JSON.stringify(coinInfo));
      writtenKeys.push(moment(new Date(coinInfo.epoch)).second(0).milliseconds(0).unix());
      writeLog(e, coinInfo);
    }
  }); 
}

new CronJob(CRON_SCHEDULE, crawl, null, true, TIMEZONE);

function writeLog(transactions, coinInfo) {
  try {
    stream.write(coinInfo.toString() + ' ' + JSON.stringify(transactions) + require('os').EOL);
  } catch (e) {
    logger.error(e);
  }
}

function writeLog2(json) {
  try {
    stream2.write(JSON.stringify(json) + require('os').EOL);
  } catch (e) {
    logger.error(e);
  }
}
