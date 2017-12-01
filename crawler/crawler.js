require('dotenv').load();
let moment = require('moment');
let Map = require('hashmap');

let CoinInfo = require('./coinInfo.js');
let CronJob = require('cron').CronJob;

// String.prototype.unquoted = function (){return this.replace (/(^")|("$)/g, '');};

const CURRENCY = process.env.CURRENCY;
const currency = CURRENCY.toLowerCase();

const CRON_SCHEDULE = process.env.CRON_SCHEDULE;
const MAX_COUNT = process.env.MAX_COUNT;
const TIMEZONE = 'Asia/Seoul';

// CONFIGRATION && LOGGER
const CONFIG = process.env.CONFIG;  // configuration folder with '/'

const json = require('json-file');
let log4js = require('log4js');
const LOG = process.env.LOG;
const LOGGER_CONFIGFILE = process.env.LOGGER_CONFIGFILE;
const LOGGER_OUTFILE = process.env.LOGGER_OUTFILE;
let logCf = new json.read(CONFIG + LOGGER_CONFIGFILE).data;
logCf.appenders.file.filename = LOG + currency + '/' + LOGGER_OUTFILE;
log4js.configure(logCf);
let log4js_extend = require('log4js-extend');
log4js_extend(log4js, {
    path: __dirname,
    format: '(@name:@line:@column)'
});
let logger = log4js.getLogger('crawler:' + currency);

const BITHUMB_URL = 'https://api.bithumb.com/public/recent_transactions/' + CURRENCY;

// Stream Roller
let rollers = require('streamroller');
let stream = new rollers.RollingFileStream(LOG + currency + '/crawler.log', 5000000, 2);
let streamRaw = new rollers.RollingFileStream(LOG  + currency + '/raw.log', 5000000, 2);

let redisClient = require('./redisClient.js');

let resize = (max) => {
    redisClient.zcard(CURRENCY, (err, res) => {
        if(err) { throw err; }
        if(res > max) {
            redisClient.zremrangebyrank(CURRENCY, 0, res - max - 1);
        }
    });
};

let lastepoch = 0;
const TWENTY_MINUTE = 1200000;

let heartbeat = () => {
    const epoch = Date.now();
    if (epoch - lastepoch > TWENTY_MINUTE) {
        lastepoch = epoch;
        logger.debug('running. cron: ' + CRON_SCHEDULE);
    }
};

let coinMap = new Map();

let Promise = require('bluebird');
let bhttp = require('bhttp');

/**
 * 분단위로 데이터를 모아서 저장
 * 데이터를 15초간격으로 crawl하여 모인 데이터의 마지각 시각이 '현재시각-1분'인 경우 저장
 */
let crawl = () => {
    Promise.try(() => bhttp.get(BITHUMB_URL))
        .then(response => response)
        .then(response => {
            writeLogRaw(response.body);
            const key = getNewCoins(response.body);
            const stableKey = key - 60;
            if(coinMap.has(stableKey)) {
                write(stableKey);
                resize(MAX_COUNT);
            }
        }).catch((e) => {
            logger.error(e);
        });

    heartbeat();
};

const contains = (list, obj) => list.some(e => (new CoinInfo([e])).toString() === (new CoinInfo([obj])).toString());

function getNewCoins(body) {
    let minuteKey = 0;
    //분 단위로 나눠서 저장 (저장시 key는 분단위 epoch)
    body.data.forEach(e => {
        minuteKey = moment(new Date(e.transaction_date)).seconds(0).milliseconds(0).unix();
        if(coinMap.has(minuteKey)){
            if(!contains(coinMap.get(minuteKey), e)) {
                coinMap.get(minuteKey).push(e);
            }
        } else {
            coinMap.set(minuteKey, [e]);
        }
    });
    return minuteKey;
}

function write(key) {
    const coins = coinMap.get(key);
    const coinInfo = new CoinInfo(coins);
    if(coinInfo.volume !== 0 && coinInfo.price !== null) {
        redisClient.zadd(CURRENCY, coinInfo.epoch, JSON.stringify(coinInfo));
        writeTradeLog(coins, coinInfo);
    }
    coinMap.delete(key);
}

new CronJob(CRON_SCHEDULE, crawl, null, true, TIMEZONE);

function writeTradeLog(transactions, coinInfo) {
    try {
        stream.write(coinInfo.toString() + ' ' + JSON.stringify(transactions) + require('os').EOL);
    } catch (e) {
        logger.error(e);
    }
}

function writeLogRaw(json) {
    try {
        streamRaw.write(JSON.stringify(json) + require('os').EOL);
    } catch (e) {
        logger.error(e);
    }
}
