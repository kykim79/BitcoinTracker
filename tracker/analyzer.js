const format = require('string-format');
format.extend(String.prototype);

const CURRENCY = process.env.CURRENCY;
const currency = CURRENCY.toLowerCase();
const LOG = process.env.LOG;

const numeral = require('numeral');
const roundTo = require('round-to');
const show = require('./showCoinValues.js');
const replier = require('./replier.js');

// date, time conversion
const moment = require('moment');

const MACD = require('technicalindicators').MACD;
const Stochastic = require('technicalindicators').Stochastic;

// Stream Roller
const rollers = require('streamroller');
const stream = new rollers.RollingFileStream(LOG + currency + '/' + process.env.TREND_FILENAME, 500000, 5);

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

const npercent = (number) => numeral(number * 100).format('0,0.000') + '%';
const EOL = require('os').EOL;
const replaceall = require('replaceall');
let isFirstTime = true; // inform current setting when this module is started

let config = readConfigFile(CONFIG_FILE).data;

watcher.add(CONFIG_FILE);
watcher.on('change', (info) => {
    config = readConfigFile(info.path).data;
});

const histoCount = 8;   // variable for ignoring if too small changes
const volumeCount = 4;   // if recent volume goes high then...

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
    if (tableSize < histoCount) {
        return null;
    }

    let nowValues = ohlcs[ohlcs.length - 1];    // last value

    nowValues.closeLast1 = closes[closes.length - 3];
    nowValues.closeLast2 = closes[closes.length - 5];
    nowValues.closeLast3 = closes[closes.length - 7];
    nowValues.closeLast4 = closes[closes.length / 2];
    nowValues.closeLast5 = closes[0];
    nowValues.closeLast1epoch = ohlcs[ohlcs.length-3].epoch;
    nowValues.closeLast2epoch = ohlcs[ohlcs.length-5].epoch;
    nowValues.closeLast3epoch = ohlcs[ohlcs.length-7].epoch;
    nowValues.closeLast4epoch = ohlcs[ohlcs.length / 2].epoch;
    nowValues.closeLast5epoch = ohlcs[0].epoch;
    // nowValues.signal = macds[tableSize - 1].signal;
    nowValues.histogram = roundTo(macds[tableSize - 1].histogram, 3);
    nowValues.histoPercent = config.histoPercent;
    nowValues.lastHistogram = roundTo(macds[tableSize - 2].histogram, 3);
    nowValues.dNow = roundTo(stochastic[stochastic.length - 1].d, 0);
    nowValues.kNow = roundTo(stochastic[stochastic.length - 1].k, 0);
    nowValues.dLast = (stochastic[stochastic.length - 2].d) ? roundTo(stochastic[stochastic.length - 2].d, 0): 0;
    nowValues.kLast = (stochastic[stochastic.length - 2].k) ? roundTo(stochastic[stochastic.length - 2].k, 0): 0;
    nowValues.sellTarget =  config.sellPrice * (1 - config.gapAllowance);
    nowValues.buyTarget =  config.buyPrice * (1 + config.gapAllowance);
    nowValues.tradeType = '';
    nowValues.msgText = '';
    nowValues.histoAvr = roundTo((macds.slice(tableSize - histoCount).map(_ => _.histogram).reduce((e1, e2) => e1 + Math.abs(e2))) / histoCount, 3);
    nowValues.histoSign = isSignChanged(macds[tableSize - 2].histogram,macds[tableSize-1].histogram) ||
                        isSignChanged(macds[tableSize - 3].histogram,macds[tableSize-1].histogram) ||
                        isSignChanged(macds[tableSize - 4].histogram,macds[tableSize-1].histogram);

    nowValues.volumeAvr = roundTo(volumes.reduce((e1, e2) => e1 + e2) / (volumes.length - 1),3);
    nowValues.volumeLast = roundTo(volumes.slice(volumes.length - volumeCount).reduce((e1, e2) => e1 + e2) / volumeCount,3);

    if (isFirstTime) {
        nowValues.msgText = '\nJust Started .. tblSize [' + tableSize + ']';
        isFirstTime = false;
    }

    nowValues = analyzeHistogram(nowValues);
    nowValues = analyzeStochastic(nowValues);
    nowValues = analyzeBoundary(nowValues);
    nowValues = analyzeVolume(nowValues);

    if (nowValues.msgText) {
        informTrade(nowValues);
    }
    keepLog(nowValues);
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

    let m = {
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
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

    let s = {
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
 * @param nv(nowValues) {Object} : gathered and calculated current values
 * @return nv.msgText if any
 */

function analyzeHistogram(nv) {

    // nv(nowValues) : current price info, calcualted analytic values

    // based on calculated MACD histogram

    let msg = '';
    // if histogram now has different sign, alert

    if (nv.histoSign) {
        if (nv.close >= nv.sellTarget) {
            nv.tradeType = SELL;
            msg = (nv.close >= config.sellPrice) ? 'Histo SIGN CHANGED, SELL' : 'Histo sign changed, Sell';
        }
        else if (nv.close <= nv.buyTarget) {
            nv.tradeType = BUY;
            msg = (nv.close <= config.buyPrice) ? 'Histo SIGN CHANGED, BUY' : 'Histo sign changed, Buy';
        }
    }

    // if histogram average is not too small and histogram sign has been changed, alert
    // very similar analysis with above nv.histoSign

    else if (nv.histoAvr > config.histogram) {
        if (nv.lastHistogram >= 0 && nv.histogram <= 0 && nv.close >= nv.sellTarget) {
            nv.tradeType = SELL;
            msg = (nv.close >= config.sellPrice) ? 'Histo: Over, Should SELL' : 'Histo: may be SELL POINT';
        }
        else if (nv.lastHistogram <= 0 && nv.histogram >= 0 && nv.close <= nv.buyTarget) {
            nv.tradeType = BUY;
            msg = (nv.close <= config.buyPrice) ? 'Histo: Under, Should BUY' : 'Histo: may be BUY POINT';
        }
    }
    else {  // below log will be removed when analytic logic become stable
        logger.debug('last [' + histoCount + '] histoAvr ' + nv.histoAvr + ' < histogram ' + config.histogram + '(' + npercent(config.histoPercent) + ')');
    }
    return appendMsg(nv,msg);
}

/**
 * analyzeStochastic : annalyze Stochastic values against configuration setting and then alert if right time
 *
 *
 * @param nv(nowValues) {Object} : gathered and calculated current values
 * @return nv.msgText if any
 */

function analyzeStochastic(nv) {

    let msg = '';
    if ((nv.dLast >= 80 && nv.kLast >= 80) && (nv.dNow < 80 || nv.kNow < 80) && nv.close >= nv.sellTarget) {
        nv.tradeType = SELL;
        msg = 'Stochastic SELL SELL';
    }
    else if ((nv.dLast <= 20 && nv.kLast <= 20) && (nv.dNow > 20 || nv.kNow > 20) && nv.close <= nv.buyTarget) {
        nv.tradeType = BUY;
        msg = 'Stochastic BUY BUY';
    }
    return appendMsg(nv,msg);
}

/**
 * analyzeBoundary : review if current prices goes out of configured buy,sell prices
 *
 *
 * @param nv(nowValues) {Object} : gathered and calculated current values
 * @return nv.msgText if any
 */

function analyzeBoundary(nv) {

    let msg = '';
    if (nv.close > config.sellPrice) {
        nv.tradeType = SELL;
        msg = 'Passing SELL boundary';
    }
    else if (nv.close < config.buyPrice) {
        nv.tradeType = BUY;
        msg = 'Passing BUY boundary';
    }
    else if (nv.close < nv.closeLast3 * (1 - UPDOWN_PERCENT)) {
        nv.tradeType = SELL;
        msg = 'Warning! goes DOWN Very Fast';
    }
    else if (nv.close > nv.closeLast3 * (1 + UPDOWN_PERCENT)) {
        nv.tradeType = BUY;
        msg = 'Warning! goes UP Very Fast';
    }
    return appendMsg(nv,msg);
}

/**
 * analyzeVolume : compare lastest volumes against volume average
 *
 *
 * @param nv(nowValues) {Object} : gathered and calculated current values
 * @return nv.msgText if any
 */

function analyzeVolume(nv) {

    let msg = '';
    if (nv.volumeLast > nv.volumeAvr * 2) {
        if (nv.close >= nv.sellTarget) {
            nv.tradeType = SELL;
            msg = 'Volume goes up rapidly, SELL ?';
        }
        else if (nv.close <= nv.buyTarget) {
            nv.tradeType = BUY;
            msg = 'Volume goes up rapidly, BUY ?';
        }
    }
    return appendMsg(nv,msg);

}

function appendMsg(nv, msg) {
    if (msg) {
        nv.msgText += '\n' + msg;
    }
    return nv;
}
/**
 * informTrade : send message to slack via web-hook
 *
 *
 * @param nv(nowValues) {Object} : gathered and calculated current values
 * @return none
 */

function informTrade(nv) {

    let attach = show.attach(nv);
    attach.title += moment(new Date(nv.epoch)).tz('Asia/Seoul').format('    YYYY-MM-DD HH:mm');
    replier.sendAttach(CURRENCY, nv.msgText, [attach]);

}

/**
 * keepLog : append nowValues into log file
 *
 *
 * @param nv(nowValues) {Object} : gathered and calculated current values
 * @return none
 */

function keepLog(nv) {

    try {
        let str = [
            CURRENCY,
            moment(new Date(nv.epoch)).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm'),
            nv.close,
            roundTo(nv.volume, 3),
            nv.volumeAvr,
            nv.volumeLast,
            nv.histogram,
            nv.histoAvr,
            (nv.histoSign) ? 'C' : '',
            nv.dNow,
            nv.kNow,
            nv.tradeType,
            replaceall(EOL, '; ', nv.msgText)
        ].join(', ');
        stream.write(str + EOL);
    } catch (e) {
        logger.error(e);
    }

    // sometimes write value header
    let d = new Date(nv.epoch);
    if (d.getMinutes() > 55 && (d.getHours() % 3 === 1)) {
        const head = 'coin, date and time  ,   close,   vol, volAvr, volLast, histogram, hisAvr, hisSign, dNow, kNow, B/S, msgText';
        stream.write(head + EOL);
    }
}
