let format = require('string-format');
format.extend(String.prototype);
const CURRENCY = process.env.CURRENCY;
let fs = require('fs');

let pad = require('pad');
let numeral = require('numeral');
let roundTo = require('round-to');
// var replaceall = require("replaceall");

// date, time conversion
let moment = require('moment');

const MACD = require('technicalindicators').MACD;
const Stochastic = require('technicalindicators').Stochastic;

// Stream Roller
let rollers = require('streamroller');
let stream = new rollers.RollingFileStream('./log/' + CURRENCY.toLowerCase() + '/trend.log', 30000, 2);

const CONFIG_FILE = './config/trackerConfig.json';

const Watcher = require('watch-files');
let watcher = Watcher({
    interval: '0.1s'
});
watcher.add(CONFIG_FILE);

let json = require('json-file');
let readAnalyzer = (path) => new json.read(path).get('analyzer');

// LOGGER
let log4js = require('log4js');
let logger = log4js.getLogger('analyzer:' + CURRENCY.toLowerCase());

let npad = (number) => (number < 1000000) ? pad(4, numeral((number)).format('0,0')) : pad(9, numeral((number)).format('0,0'));
let npercent = (number) => numeral(number * 100).format('0,0.00') + '%';
let note = require('./notifier.js');
let TradeType = require('./tradeType.js');
let isFirstTime = true; // inform current setting when this module is started

let analyzer = readAnalyzer(CONFIG_FILE);

watcher.on('change', (info) => {
    analyzer = readAnalyzer(info.path);
    analyzer.histogram = roundTo((analyzer.sellPrice + analyzer.buyPrice) / 2 * analyzer.histoPercent, 2);
    const v = 'Sell:{sell}, histo:{histo}\nBuy :{buy}, gap:{gap}'.format({
        sell: npad(analyzer.sellPrice),
        buy: npad(analyzer.buyPrice),
        gap: npercent(analyzer.gapAllowance),
        histo: npercent(analyzer.histoPercent)
    });
    note.info(v, '*Config Changed*');   // will be removed later
    logger.info(v, '*Config Changed*');
});

const histoCount = 8;   // variable for ignoring if too small changes

let ohlcBuilder = require('./ohlcBuilder.js');
ohlcBuilder.getEmitter().on('event', listener);

function listener(ohlcs) {

    // ohlcs  =
    // [
    //     {epoch, price, volume, date, high, low, close, open},
    //     {epoch, price, volume, date, high, low, close, open}
    // ]
    const closes = ohlcs.map(_ => _.close);
    const highs = ohlcs.map(_ => _.high);
    const lows = ohlcs.map(_ => _.low);

    let macds = calculateMACD(closes);
    let stochastic = calculateStochastic(highs, lows, closes);

    let tableSize = macds.length;
    if (tableSize < histoCount) {
        return;
    }

    let nowValues = ohlcs[ohlcs.length - 1];
    nowValues.MACD = macds[tableSize - 1].MACD;
    nowValues.signal = macds[tableSize - 1].signal;
    nowValues.histogram = roundTo(macds[tableSize - 1].histogram, 3);
    nowValues.histoPercent = analyzer.histoPercent;
    nowValues.lastHistogram = roundTo(macds[tableSize - 2].histogram, 3);
    nowValues.dNow = roundTo(stochastic[stochastic.length - 1].d, 3);
    nowValues.kNow = roundTo(stochastic[stochastic.length - 1].k, 3);
    nowValues.dLast = roundTo(stochastic[stochastic.length - 2].d, 3);
    nowValues.kLast = (stochastic[stochastic.length - 2].k) ? roundTo(stochastic[stochastic.length - 2].k, 3): 0;
    nowValues.tradeType = '';
    nowValues.msgText = '';
    nowValues.histoAvr = roundTo((macds.slice(tableSize - histoCount).map(_ => _.histogram).reduce((e1, e2) => e1 + Math.abs(e2))) / histoCount, 2);

    if (isFirstTime) {
        justStarted(nowValues, analyzer, tableSize);
        isFirstTime = false;
    }

    nowValues.msgText += analyzeHistogram(nowValues);
    nowValues.msgText += analyzeStochastic(nowValues);
    nowValues.msgText += analyzeBoundary(nowValues);

    keepLog(nowValues);
}

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

function calculateStochastic(highs, lows, closes) {
    let s = {
        high: highs,
        low: lows,
        close: closes,
        period: 14,
        signalPeriod: 3
    };

    let stochastic = Stochastic.calculate(s);
    return stochastic;
}

function justStarted(nowValues, analyzer, tableSize) {
    const v = {
        sell: npad(analyzer.sellPrice),
        buy: npad(analyzer.buyPrice),
        size: tableSize,
        gap: npercent(analyzer.gapAllowance),
        now: npad(nowValues.close),
        histo: npercent(analyzer.histoPercent)
    };
    const m = 'Buy  :{buy}  tblSz :{size}\n' +
        'Now  :{now}  gap :{gap}\n' +
        'Sell :{sell}  histo(div):{histo}'; // .format(v); does not work
    note.info(m.format(v), '*_Monitoring Started_*');
}

function analyzeHistogram(nv) {
    let msg = '';
    if (nv.histoAvr > analyzer.histogram) {
        if (nv.lastHistogram >= 0 && nv.histogram <= 0 &&
            (Math.abs(analyzer.sellPrice - nv.close) / nv.close) < analyzer.gapAllowance) {
            nv.tradeType = TradeType.SELL;
            msg = (nv.close >= analyzer.sellPrice) ? '*Over, Should SELL*' : 'SELL POINT';
        }
        else if (nv.lastHistogram <= 0 && nv.histogram >= 0 &&
            (Math.abs(analyzer.buyPrice - nv.close) / nv.close) < analyzer.gapAllowance) {
            nv.tradeType = TradeType.BUY;
            msg = (nv.close <= analyzer.buyPrice) ? '*Under, Should BUY*' : 'BUY POINT';
        }
        if (msg) {
            informTrade(nv,msg);
        }
    }
    else {
        logger.debug('last [' + histoCount + '] histoAvr ' + nv.histoAvr + ' < histogram ' + analyzer.histogram + '(' + npercent(analyzer.histoPercent) + ')');
    }
    return msg;
}

function analyzeStochastic(nv) {
    let msg = '';
    if (nv.dLast >= 80 && nv.kLast >= 80) {
        if (nv.dNow < 80 || nv.kNow < 80) {
            nv.tradeType = TradeType.SELL;
            if ((Math.abs(analyzer.sellPrice - nv.close) / nv.close) < analyzer.gapAllowance) {
                msg = '*Stochastic SELL SELL*';
            }
            else {
                msg = 'Stochastic SELL?';
            }
        }
    }
    else if (nv.dLast <= 20 && nv.kLast <= 20) {
        if (nv.dNow > 20 || nv.kNow > 20) {
            nv.tradeType = TradeType.BUY;
            if ((Math.abs(analyzer.buyPrice - nv.close) / nv.close) < analyzer.gapAllowance) {
                msg = '*Stochastic BUY BUY*';
            } else {
                msg = 'Stochastic BUY?';
            }
        }
    }
    if (msg) {
        informTrade(nv,msg);
        logger.debug(msg + ' : dLast ' + nv.dLast + ', kLast ' + nv.kLast + ', dNow  ' + nv.dNow + ', kNow  ' + nv.kNow);
    }
    return msg;
}

function analyzeBoundary(nv) {
    let msg = '';
    if (nv.close > analyzer.sellPrice) {
        nv.tradeType = TradeType.SELL;
        msg = '_Going Over sellPrice';
    }
    else if (nv.close < analyzer.buyPrice) {
        nv.tradeType = TradeType.BUY;
        msg = '_Going Under buyPrice_';
    }
    if (msg) {
        informTrade(nv,msg);
        logger.debug('Boundary alert ' + msg);
    }
    return msg;
}

function informTrade(nv, msg) {
    const target = ( nv.tradeType === TradeType.SELL) ? analyzer.sellPrice : analyzer.buyPrice;
    const v = {
        nowNpad: npad(nv.close),
        buysell: ( nv.tradeType === TradeType.SELL) ? 'SELL' : 'BUY ',
        targetNpad: npad(target),
        gap: npad(nv.close - target),
        gapPcnt: npercent((nv.close - target) / target),
        volume: numeral(nv.volume).format('0,0'),
        histo: npercent(nv.histoPercent),
        histoAvr: npad(nv.histoAvr)
    };
    const m = 'Now :{nowNpad}  vol:{volume}\n' +
        '{buysell}:{targetNpad}  histoAvr:{histoAvr}\n' +
        'Gap :{gap}    histo(div):{histo}\n' +
        'Gap%: {gapPcnt}\n'; // .format(v); does'n work

    note.danger(m.format(v), msg);
}

function keepLog(nv) {

    try {
        let str = [
            CURRENCY,
            moment(new Date(nv.epoch)).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm'),
            nv.open,
            nv.high,
            nv.low,
            nv.close,
            roundTo(nv.volume, 2),
            roundTo(nv.MACD, 2),
            roundTo(nv.signal, 2),
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
}
