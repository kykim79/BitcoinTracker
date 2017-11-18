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

// date, time conversion
const moment = require('moment');

const MACD = require('technicalindicators').MACD;
const Stochastic = require('technicalindicators').Stochastic;

// Stream Roller
const rollers = require('streamroller');
const stream = new rollers.RollingFileStream(LOG + 'trend.log', 100000, 3);

const CONFIG_FILE = process.env.CONFIG + currency + '/trackerConfig.json';

const Watcher = require('watch-files');
const watcher = Watcher({
    interval: '0.1s'
});
watcher.add(CONFIG_FILE);

const json = require('json-file');
let readConfigFile = (path) => new json.read(path);

const logger = require('./logger.js').getLogger('analyzer:' + currency);

let npad = (number) => pad(NPAD_SIZE, numeral((number)).format('0,0'));

const npercent = (number) => numeral(number * 100).format('0,0.000') + '%';
const note = require('./notifier.js');
const TradeType = require('./tradeType.js');
let isFirstTime = true; // inform current setting when this module is started

let config = readConfigFile(CONFIG_FILE).data;

watcher.on('change', (info) => {
    config = readConfigFile(info.path).data;
    logger.debug('histogram value : ' +config.histogram);
    // config.histogram = roundTo((config.sellPrice + config.buyPrice) / 2 * config.histoPercent, 2);
});

const histoCount = 8;   // variable for ignoring if too small changes

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
    nowValues.dNow = roundTo(stochastic[stochastic.length - 1].d, 3);
    nowValues.kNow = roundTo(stochastic[stochastic.length - 1].k, 3);
    nowValues.dLast = (stochastic[stochastic.length - 2].d) ? roundTo(stochastic[stochastic.length - 2].d, 3): 0;
    nowValues.kLast = (stochastic[stochastic.length - 2].k) ? roundTo(stochastic[stochastic.length - 2].k, 3): 0;
    nowValues.tradeType = '';
    nowValues.msgText = '';
    nowValues.histoAvr = roundTo((macds.slice(tableSize - histoCount).map(_ => _.histogram).reduce((e1, e2) => e1 + Math.abs(e2))) / histoCount, 3);
    nowValues.histoSign = isSignChanged(macds[tableSize - 2].histogram,macds[tableSize-1].histogram) ||
                        isSignChanged(macds[tableSize - 3].histogram,macds[tableSize-1].histogram) ||
                        isSignChanged(macds[tableSize - 4].histogram,macds[tableSize-1].histogram);

    if (isFirstTime) {
        justStarted(nowValues, config, tableSize);
        isFirstTime = false;
    }

    nowValues = analyzeHistogram(nowValues);
    nowValues = analyzeStochastic(nowValues);
    nowValues = analyzeBoundary(nowValues);

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
        if (nv.histogram <= 0 && (Math.abs(config.sellPrice - nv.close) / nv.close) <= config.gapAllowance) {
            nv.tradeType = TradeType.SELL;
            msg = (nv.close >= config.sellPrice) ? '*SELL*, histo sign Changed' : '_Histo says_ SELL';
        }
        else if (nv.histogram >= 0 && (Math.abs(config.buyPrice - nv.close) / nv.close) <= config.gapAllowance) {
            nv.tradeType = TradeType.BUY;
            msg = (nv.close <= config.buyPrice) ? '*BUY*, histo sign changed' : '_Histo says_ BUY';
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
    if (msg) {
        informTrade(nv,msg);
        nv.msgText += msg;
    }
    return nv;
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
    if ((nv.dLast >= 80 && nv.kLast >= 80) && (nv.dNow < 80 || nv.kNow < 80) && ((Math.abs(config.sellPrice - nv.close) / nv.close) <= config.gapAllowance)) {
        nv.tradeType = TradeType.SELL;
        msg = '_Stochastic_ SELL SELL';
    }
    else if ((nv.dLast <= 20 && nv.kLast <= 20) && (nv.dNow > 20 || nv.kNow > 20) && ((Math.abs(config.buyPrice - nv.close) / nv.close) <= config.gapAllowance)) {
        nv.tradeType = TradeType.BUY;
        msg = '_Stochastic_ BUY BUY';
    }
    if (msg) {
        nv.msgText += msg;
        informTrade(nv,msg);
    }
    return nv;
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
        msg = 'Going Over _SELL_ boundary';
    }
    else if (nv.close < config.buyPrice) {
        nv.tradeType = TradeType.BUY;
        msg = 'Going Under _BUY_ boundary';
    }
    if (msg) {
        informTrade(nv,msg);
        logger.debug('Boundary alert ' + msg);
        nv.msgText += msg;
    }
    return nv;
}


/**
 * informTrade : send message to slack via web-hook
 *
 *
 * @param nv(nowValues) {Object} : gathered and calculated current values
 * @param msg {text} : header message
 * @return none
 */

function informTrade(nv, msg) {

    const target = ( nv.tradeType === TradeType.SELL) ? config.sellPrice : config.buyPrice;
    const v = {
        nowNpad: npad(nv.close),
        buysell: pad(nv.tradeType.key, 4),
        targetNpad: npad(target),
        gap: npad(nv.close - target),
        gapPcnt: npercent((nv.close - target) / target),
        volume: npad(nv.volume),
        histogram: npad(config.histogram),
        histopct: npercent(nv.histoPercent),
        histoAvr: npad( nv.histoAvr),
        dl: numeral(nv.dLast).format('0.0'),
        kl: numeral(nv.kLast).format('0.0'),
        dn: numeral(nv.dNow).format('0.0'),
        kn: numeral(nv.kNow).format('0.0')
    };
    const m = 'Now :{nowNpad}  h(set):{histogram}\n' +
        '{buysell}:{targetNpad}  h(pct): {histopct}\n' +
        'Gap :{gap}   h(avr):{histoAvr}\n' +
        'Gap%:    {gapPcnt}    volume: {volume}\n' +
        'dk ({dl},{kl}) => ({dn},{kn})';

    note.danger(m.format(v), msg);
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
            // nv.open,
            // nv.high,
            // nv.low,
            nv.close,
            roundTo(nv.volume, 2),
            // roundTo(nv.MACD, 2),
            // roundTo(nv.signal, 2),
            nv.histogram,
            nv.histoAvr,
            nv.dNow,
            nv.kNow,
            nv.tradeType,
            nv.msgText
        ].join(', ');
        stream.write(str + require('os').EOL);
    } catch (e) {
        logger.error(e);
    }

    // sometimes write value header
    let d = new Date(nv.epoch);
    if (d.getMinutes() > 55 && (d.getHours() % 2 === 1)) {
        const head = 'coin, date and time  ,   close,   vol, histogram, hisAvr, dNow, kNow, B/S, msgText';
        stream.write(head + require('os').EOL);
    }
}
