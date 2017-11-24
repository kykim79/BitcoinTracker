const format = require('string-format');
format.extend(String.prototype);

const CURRENCY = process.env.CURRENCY;
const currency = CURRENCY.toLowerCase();
const LOG = process.env.LOG;
const NPAD_SIZE = Number(process.env.NPAD_SIZE);

// let fs = require('fs');

const pad = require('pad');
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
const stream = new rollers.RollingFileStream(LOG + currency + '/' + process.env.TREND_FILENAME, 200000, 3);

const Watcher = require('watch-files');
const watcher = Watcher({
    interval: '0.1s'
});
const json = require('json-file');
let readConfigFile = (path) => new json.read(path);

const CONFIG = process.env.CONFIG;  // configuration folder with '/'
const CONFIG_FILE = CONFIG + currency + '/' + process.env.CONFIG_FILENAME;

// LOGGER
let log4js = require('log4js');
const logger = log4js.getLogger('analyzer:' + currency);

const npad = (number) => pad(NPAD_SIZE, numeral((number)).format('0,0'));

const npercent = (number) => numeral(number * 100).format('0,0.000') + '%';
const note = require('./notifier.js');
const TradeType = require('./tradeType.js');
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

    // nowValues.MACD = macds[tableSize - 1].MACD;
    // nowValues.signal = macds[tableSize - 1].signal;
    nowValues.histogram = roundTo(macds[tableSize - 1].histogram, 3);
    nowValues.histoPercent = config.histoPercent;
    nowValues.lastHistogram = roundTo(macds[tableSize - 2].histogram, 3);
    nowValues.dNow = roundTo(stochastic[stochastic.length - 1].d, 0);
    nowValues.kNow = roundTo(stochastic[stochastic.length - 1].k, 0);
    nowValues.dLast = (stochastic[stochastic.length - 2].d) ? roundTo(stochastic[stochastic.length - 2].d, 0): 0;
    nowValues.kLast = (stochastic[stochastic.length - 2].k) ? roundTo(stochastic[stochastic.length - 2].k, 0): 0;
    nowValues.tradeType = '';
    nowValues.msgText = '';
    nowValues.histoAvr = roundTo((macds.slice(tableSize - histoCount).map(_ => _.histogram).reduce((e1, e2) => e1 + Math.abs(e2))) / histoCount, 3);
    nowValues.histoSign = isSignChanged(macds[tableSize - 2].histogram,macds[tableSize-1].histogram) ||
                        isSignChanged(macds[tableSize - 3].histogram,macds[tableSize-1].histogram) ||
                        isSignChanged(macds[tableSize - 4].histogram,macds[tableSize-1].histogram);

    nowValues.volumeAvr = roundTo(volumes.reduce((e1, e2) => e1 + e2) / (volumes.length - 1),3);
    nowValues.volumeLast = roundTo(volumes.slice(volumes.length - volumeCount).reduce((e1, e2) => e1 + e2) / volumeCount,3);

    if (isFirstTime) {
        justStarted(nowValues, config, tableSize);
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
 * justStarted : inform to slack that this analytic program has been started
 *
 *
 * @param nowValues {Object} : gathered and calculated current values
 * @param config {Object} : current configuration setting
 * @param tableSize {var} : length of MACD array
 * @return none
 */

function justStarted(nowValues, config, tableSize) {

    // nowValues : current price info, calcualted analytic values
    // config    : trackerConfig.json values
    // tableSize : MACD array count

    const v = {
        sell: npad(config.sellPrice),
        buy: npad(config.buyPrice),
        size: tableSize,
        gap: npercent(config.gapAllowance),
        now: npad(nowValues.close),
        histo: npercent(config.histoPercent)
    };
    const m = format('Buy  :{buy}   tblSz :{size}\n' +
        'Now  :{now}   gap   :{gap}\n' +
        'Sell:{sell}   h(div):{histo}', v);
    note.info(m, 'Analyzing Started');
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
        if (nv.close >= config.sellPrice * (1 - config.gapAllowance)) {
            nv.tradeType = TradeType.SELL;
            msg = (nv.close >= config.sellPrice) ? 'SELL, histo sign Changed' : 'Histo says sell';
        }
        else if (nv.close <= config.buyPrice * (1 + config.gapAllowance)) {
            nv.tradeType = TradeType.BUY;
            msg = (nv.close <= config.buyPrice) ? 'BUY, histo sign changed' : 'Histo says buy';
        }
    }

    // if histogram average is not too small and histogram sign has been changed, alert
    // very similar analysis with above nv.histoSign

    else if (nv.histoAvr > config.histogram) {
        if (nv.lastHistogram >= 0 && nv.histogram <= 0 && (Math.abs(config.sellPrice - nv.close) / nv.close) <= config.gapAllowance) {
            nv.tradeType = TradeType.SELL;
            msg = (nv.close >= config.sellPrice) ? 'Over, Should SELL' : 'may be SELL POINT';
        }
        else if (nv.lastHistogram <= 0 && nv.histogram >= 0 && (Math.abs(config.buyPrice - nv.close) / nv.close) <= config.gapAllowance) {
            nv.tradeType = TradeType.BUY;
            msg = (nv.close <= config.buyPrice) ? 'Under, Should BUY' : 'may be BUY POINT';
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
    if ((nv.dLast >= 80 && nv.kLast >= 80) && (nv.dNow < 80 || nv.kNow < 80) && nv.close >= config.sellPrice * (1 - config.gapAllowance)) {
        nv.tradeType = TradeType.SELL;
        msg = 'Stochastic SELL SELL';
    }
    else if ((nv.dLast <= 20 && nv.kLast <= 20) && (nv.dNow > 20 || nv.kNow > 20) && nv.close <= config.buyPrice * (1 + config.gapAllowance)) {
        nv.tradeType = TradeType.BUY;
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
        nv.tradeType = TradeType.SELL;
        msg = 'Going Over SELL boundary';
    }
    else if (nv.close < config.buyPrice) {
        nv.tradeType = TradeType.BUY;
        msg = 'Going Under BUY boundary';
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
        if (nv.close >= config.sellPrice * (1 - config.gapAllowance)) {
            nv.tradeType = TradeType.SELL;
            msg = 'Volume goes up rapidly, SELL ?';
        }
        else if (nv.close <= config.buyPrice * (1 + config.gapAllowance)) {
            nv.tradeType = TradeType.BUY;
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

    replier.sendAttach(currency, nv.msgText, [show.attach(nv)]);

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
        const head = 'coin, date and time  ,   close,   vol, volAvr, volLast, histogram, hisAvr, dNow, kNow, B/S, msgText';
        stream.write(head + EOL);
    }
}
