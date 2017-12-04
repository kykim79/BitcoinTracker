const format = require('string-format');
format.extend(String.prototype);

const CURRENCY = process.env.CURRENCY;
const currency = CURRENCY.toLowerCase();
const LOG = process.env.LOG;
const PRICE_ROUND_RADIX = Number(process.env.PRICE_ROUND_RADIX);

const roundTo = require('round-to');
const show = require('./showCoinValues.js');
const replier = require('./replier.js');

const MACD = require('technicalindicators').MACD;
const Stochastic = require('technicalindicators').Stochastic;

// Stream Roller
const rollers = require('streamroller');
const stream = new rollers.RollingFileStream(LOG + currency + '/' + process.env.TREND_FILENAME, 1000000, 2);

const Watcher = require('watch-files');
const watcher = Watcher({
    interval: '0.5s'
});
const json = require('json-file');
let readConfigFile = (path) => new json.read(path);

const CONFIG = process.env.CONFIG;  // configuration folder with '/'
const CONFIG_FILE = CONFIG + currency + '/' + process.env.CONFIG_FILENAME;
const UPDOWN_PERCENT = Number(process.env.UPDOWN_PERCENT) / 100;

// LOGGER
let log4js = require('log4js');
const logger = log4js.getLogger('analyzer:' + currency);

const EOL = require('os').EOL;
const replaceall = require('replaceall');
let isFirstTime = true; // inform current setting when this module is started

let config = readConfigFile(CONFIG_FILE).data;
let sellBoundaryCount = 0;
let buyBoundaryCount = 0;
let nowValues;

watcher.add(CONFIG_FILE);
watcher.on('change', (info) => {
    config = readConfigFile(info.path).data;
    logger.debug('configration changed');
    sellBoundaryCount = 0;
    buyBoundaryCount = 0;

});

const volumeCOUNT = 3;   // if recent volume goes high then...

const ohlcBuilder = require('./ohlcBuilder.js');
ohlcBuilder.getEmitter().on('event', listener);

const SELL = 'S';
const BUY = 'B';

/**
 * lister : main
 *
 * - triggered by ohlcBuilder.js
 * - build required tables for MACD, Stochastic
 * - calculate MACD, Stochastic values
 * - alert to slack if values are within range
 *
 * @param ohlcs {Array} : prices array [{epoch, price, volume, date, high, low, close, open}]
 * @return none
 */

function listener(ohlcs) {

    const closes = ohlcs.map(_ => _.close);
    const highs = ohlcs.map(_ => _.high);
    const lows = ohlcs.map(_ => _.low);
    const volumes = ohlcs.map(_ => _.volume);

    let macds = calculateMACD(closes);
    let stochastic = calculateStochastic(highs, lows, closes);

    let tableSize = macds.length;

    nowValues = ohlcs[ohlcs.length - 1];

    nowValues.prevValues = [ohlcs[ohlcs.length - 3], ohlcs[ohlcs.length - 5], ohlcs[ohlcs.length - 7], ohlcs[Math.trunc(ohlcs.length / 2)], ohlcs[0]];
    nowValues.periodMax = Math.max(...highs);
    nowValues.periodMin = Math.min(...lows);

    nowValues.histogram = roundTo(macds[tableSize - 1].histogram, 1);
    nowValues.histoSign = isSignChanged(macds[tableSize - 2].histogram,macds[tableSize-1].histogram)
        || isSignChanged(macds[tableSize - 3].histogram,macds[tableSize-1].histogram);

    nowValues.dNow = roundTo(stochastic[stochastic.length - 1].d, 0);
    nowValues.kNow = roundTo(stochastic[stochastic.length - 1].k, 0);
    nowValues.dLast = (stochastic[stochastic.length - 2].d) ? roundTo(stochastic[stochastic.length - 2].d, 0): 0;
    nowValues.kLast = (stochastic[stochastic.length - 2].k) ? roundTo(stochastic[stochastic.length - 2].k, 0): 0;

    nowValues.volumeAvr = roundTo(volumes.slice(volumes.length - volumeCOUNT * 8).reduce((e1, e2) => e1 + e2) / (volumeCOUNT * 8),1);
    nowValues.volumeLast = roundTo(volumes.slice(volumes.length - volumeCOUNT).reduce((e1, e2) => e1 + e2) / volumeCOUNT,1);

    nowValues.sellTarget = config.sellPrice * (1 - config.gapAllowance);
    nowValues.buyTarget = config.buyPrice * (1 + config.gapAllowance);

    nowValues.tradeType = '';
    nowValues.msgText = '';

    if (isFirstTime) {
        nowValues.msgText = '\nJust Started, with size [' + tableSize + ']';
        isFirstTime = false;
    }

    analyzeHistogram();
    analyzeStochastic();
    analyzeBoundary();
    analyzeVolume();

    if (nowValues.msgText) {
        informTrade();
    }
    keepLog();
}

/**
 * calculateMACD : calculate MACD values
 *
 * - require "technicalindicators": "^1.0.20"
 * - generate MACD array
 *
 * @param closes {Array} : close prices array [close]
 * @return MACD {Array} : [{MACD, signal, histogram}]
 */

function calculateMACD(closes) {

    const m = {
        values: closes,
        fastPeriod: 8,
        slowPeriod: 17,
        signalPeriod: 5,
        SimpleMAOscillator: false,
        SimpleMASignal: false
    };
    return MACD.calculate(m);
}

function isSignChanged(before,after) {

    // to flag on if recent histogram sign has been changed
    return (before >= 0 && after <= 0) || (before <= 0 && after >= 0);
}

/**
 * calculateStochastic : calculate Stochastic values
 *
 * - require "technicalindicators": "^1.0.20"
 * - generate Stochastic array
 *
 * @param highs {Array} : close prices array [close]
 * @param lows {Array} : close prices array [close]
 * @param closes {Array} : close prices array [close]
 * @return Stochastic {Array} : [d, k}]
 */

function calculateStochastic(highs, lows, closes) {

    const s = {
        high: highs,
        low: lows,
        close: closes,
        period: 14,
        signalPeriod: 3
    };
    return Stochastic.calculate(s);
}

/**
 * analyzeHistogram : annalyze histogram values against configuration setting and then alert if right time
 *
 *
 * @return nv.msgText if any
 */

function analyzeHistogram() {

    if (nowValues.histoSign) {
        let msg = '';
        if (nowValues.close > nowValues.sellTarget) {
            nowValues.tradeType = SELL;
            msg = (nowValues.close > config.sellPrice) ? 'Histo SAYS SELL, SELL' : 'Histo says sell';
        }
        else if (nowValues.close < nowValues.buyTarget) {
            nowValues.tradeType = BUY;
            msg = (nowValues.close < config.buyPrice) ? 'Histo SAYS BUY, BUY' : 'Histo says buy';
        }
        appendMsg(msg);
    }

}

/**
 * analyzeStochastic : annalyze Stochastic values against configuration setting and then alert if right time
 *
 *
 * @return nv.msgText if any
 */

function analyzeStochastic() {

    let msg = '';
    if ((nowValues.dLast >= 80 && nowValues.kLast >= 80) && (nowValues.dNow < 80 || nowValues.kNow < 80) && nowValues.close >= nowValues.sellTarget) {
        nowValues.tradeType = SELL;
        msg = 'Stochastic SELL SELL';
    }
    else if ((nowValues.dLast <= 20 && nowValues.kLast <= 20) && (nowValues.dNow > 20 || nowValues.kNow > 20) && nowValues.close <= nowValues.buyTarget) {
        nowValues.tradeType = BUY;
        msg = 'Stochastic BUY BUY';
    }
    appendMsg(msg);
}

/**
 * analyzeBoundary : review if current prices goes out of configured buy,sell prices
 *
 *
 * @return nv.msgText if any
 */

function analyzeBoundary() {

    let msg = '';
    if (nowValues.close > config.sellPrice) {
        nowValues.tradeType = SELL;
        msg = 'Passing SELL boundary (' + sellBoundaryCount + ')';
        if (sellBoundaryCount++ > 4) {   // if goes over boundary several times, then adjust boundary temperary
            config.sellPrice = roundTo(nowValues.close * (1 + config.gapAllowance),PRICE_ROUND_RADIX + 1);
            sellBoundaryCount = 0;
            msg += '\nSELL PRICE adjusted temperary';
        }
    }
    else if (nowValues.close < config.buyPrice) {
        nowValues.tradeType = BUY;
        msg = 'Passing BUY boundary (' + buyBoundaryCount + ')';
        if (buyBoundaryCount++ > 4) {
            config.buyPrice = roundTo(nowValues.close * (1 - config.gapAllowance),PRICE_ROUND_RADIX + 1);
            buyBoundaryCount = 0;
            msg += '\nBUY PRICE adjusted temperary';
        }
    }
    if (msg) {
        appendMsg(msg);
        msg = '';
    }

    if (nowValues.close < nowValues.prevValues[2].close * (1 - UPDOWN_PERCENT)) {
        nowValues.tradeType = SELL;
        msg = 'Fast Price DOWN (' + roundTo((nowValues.close - nowValues.prevValues[2].close) / nowValues.close * 100,0) + '%)';
    }
    else if (nowValues.close > nowValues.prevValues[2].close * (1 + UPDOWN_PERCENT)) {
        nowValues.tradeType = BUY;
        msg = 'Fast Price UP (' + roundTo((nowValues.close - nowValues.prevValues[2].close) / nowValues.close * 100,0) + '%)';
    }
    appendMsg(msg);
}

/**
 * analyzeVolume : compare lastest volumes against volume average
 *
 *
 * @return nv.msgText if any
 */

function analyzeVolume() {

    let msg = '';
    const volumeRATE = 2.0;
    if (nowValues.volumeLast > nowValues.volumeAvr * volumeRATE) {
        msg = 'Big Volume (> ' + roundTo(nowValues.volumeLast / nowValues.volumeAvr * 100,0) + '%), ';
        if (nowValues.close > nowValues.sellTarget) {
            nowValues.tradeType = SELL;
            msg += 'SELL ?';
        }
        else if (nowValues.close < nowValues.buyTarget) {
            nowValues.tradeType = BUY;
            msg += 'BUY ?';
        }
        else {
            msg += 'BUY/SELL ?';
        }
    }
    appendMsg(msg);
}

function appendMsg(msg) {
    if (msg) {
        nowValues.msgText += '\n' + msg;
    }
}
/**
 * informTrade : send message to slack via web-hook
 *
 *
 * @return none
 */

function informTrade() {

    let attach = show.attach(nowValues,config);
    attach.title += '   ' + nowValues.date.substring(5);
    replier.sendAttach(CURRENCY, nowValues.msgText, [attach]);

}

/**
 * keepLog : append nowValues into log file
 *
 *
 * @return none
 */

function keepLog() {

    try {
        let str = [
            CURRENCY,
            nowValues.date,
            nowValues.close,
            nowValues.volume,
            nowValues.volumeAvr,
            nowValues.volumeLast,
            nowValues.histogram,
            (nowValues.histoSign) ? 'C' : '',
            nowValues.dNow,
            nowValues.kNow,
            nowValues.tradeType,
            replaceall(EOL, '; ', nowValues.msgText)
        ].join(', ');
        stream.write(str + EOL);
    } catch (e) {
        logger.error(e);
    }

    // sometimes write value header
    let d = new Date(nowValues.epoch);
    if (d.getMinutes() > 55 && (d.getHours() % 3 === 1)) {
        const head = 'coin, date and time  ,   close,  vol, volAvr, volLast, histo, Sign, dNow, kNow, B/S, msgText';
        stream.write(head + EOL);
    }
}
