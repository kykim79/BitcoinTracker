var format = require('string-format');
format.extend(String.prototype);

let pad = require('pad');
let numeral = require('numeral');
let roundTo = require('round-to');
// var replaceall = require("replaceall");

// date, time conversion
var moment = require('moment');

// macd calculator
// var jsonexport = require('jsonexport');
var MACD = require('technicalindicators').MACD;

// Stream Roller
var rollers = require('streamroller');
var stream = new rollers.RollingFileStream('./log/trend.log', 100000, 2);


// LOGGER
let log4js = require('log4js');
let logger = log4js.getLogger('analyzer');

// CONFIG
const ANALYZER = 'analyzer';
const CURRENCY = 'currency';
const ConfigWatch = require("config-watch");
const CONFIG_FILE = './config/trackerConfig.json';
let configWatch = new ConfigWatch(CONFIG_FILE);
let analyzer = configWatch.get(ANALYZER);
let currency = configWatch.get(CURRENCY);

configWatch.on("change", (err, config) => {
    if (err) { throw err; }
    if (config.hasChanged(ANALYZER)) {
        analyzer = config.get(ANALYZER);
        note.warn('buy:{buyPrice}, sell:{sellPrice}, divergence:{divergence}'.format(analyzer),'*Config Change*');
    }
});

let npad = (number) => pad(9, numeral((number)).format('0,0'));

let note = require('./notifier.js');

// let TradeStatus = require('./tradeStatus.js');

let TradeType = require('./tradeType.js');

let isRestarted = true;

var ohlcBuilder = require('./ohlcBuilder.js');
ohlcBuilder.getEmitter().on('event', listener);

function listener(ohlcs) {

    // ohlcs  = 
    // [
    //     {epoch, price, volume, date, high, low, close, open},
    //     {epoch, price, volume, date, high, low, close, open}
    // ]
    const closes = ohlcs.map(_ => _.close);

    var macdInput = {
        values            : closes,
        fastPeriod        : 12,
        slowPeriod        : 26,
        signalPeriod      : 9 ,
        SimpleMAOscillator: false,
        SimpleMASignal    : false
    };

    var macds = MACD.calculate(macdInput);
    // logger.debug('macds length = ' + macds.length);
    // logger.debug(macds[macds.length-1]);
    var tradeType = '';
    var msgText = '';

    let tableSize = macds.length;
    if (isRestarted) {
        note.info('Restart with length : ' + tableSize, '*_RESTART_*');
        isRestarted = false;
    }
    if (tableSize < 5) {
        return;
    }
 
    var nowValues = ohlcs[ohlcs.length - 1];
    nowValues.MACD = macds[tableSize - 1].MACD;
    nowValues.signal = macds[tableSize - 1].signal;
    nowValues.histogram = macds[tableSize - 1].histogram;
    
    nowValues.histoSum = macds.slice(tableSize - 5).map(_ => _.histogram).reduce((e1, e2) => e1 + (e2 * e2));
    
    if (nowValues.histoSum > analyzer.divergence) {
        var nowHistogram = nowValues.histogram;
        var lastHistogram = macds[tableSize - 2].histogram;
        if (nowHistogram == 0) {
            tradeType = (lastHistogram > 0) ? TradeType.SELL : TradeType.BUY;
            msgText = (lastHistogram > 0) ? '*SELL SELL SELL*' : '*BUY BUY BUY*';
        }
        else if (lastHistogram >= 0 && nowHistogram < 0) {
            tradeType = TradeType.SELL;
            msgText = '*SELL POINT*';
        }
        else if (lastHistogram <= 0 && nowHistogram > 0) {
            tradeType = TradeType.BUY;
            msgText = '*BUY POINT*';
        }
        // if (tradeType) {
        if (msgText) {
            informTrade(nowValues, tradeType, msgText);
        }
    }
    else {
        logger.debug('Sum of last 5 is too small : ' + roundTo(nowValues.histoSum, 2));
    }
    if (!tradeType) {
        if (nowValues.close > analyzer.sellPrice) {
            msgText = 'Higher Price';
            informTrade(nowValues, TradeType.SELL, msgText);
        } 
        else if (nowValues.close < analyzer.buyPrice) {
            msgText = 'Lower Price';
            informTrade(nowValues, TradeType.BUY, msgText);
        }
    }
    keepLog(nowValues, tradeType, msgText);
}

function informTrade(nowValues, tradeType, msgText) {
    const now = nowValues.close;
    const target = ( tradeType == TradeType.SELL) ? analyzer.sellPrice : analyzer.buyPrice;
    const v= {
        nowNpad     : npad(now),
        buysell     : tradeType,
        targetNpad  : npad(target),
        gap         : npad(now - target),
        volume      : numeral(nowValues.volume).format('0,0.00'),
        hist        : numeral(nowValues.histogram).format('0,0.00'),
        histoSum    : numeral(nowValues.histoSum).format('0,0.00')
    };
    const f = 'Now :{nowNpad} vol:{volume}\n' +
        '{buysell}:{targetNpad} gap:{gap}\n' +
        'hist:{hist} sum:{histoSum}';

    note.danger(f.format(v), msgText);
}

function keepLog(nowValues, tradetype, msgText) {

    try {
        let str = [
            moment(new Date(nowValues.epoch)).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm'),
            nowValues.open, 
            nowValues.high, 
            nowValues.low, 
            nowValues.close,
            roundTo(nowValues.volume,2),
            roundTo(nowValues.MACD,2),
            roundTo(nowValues.signal,2),
            roundTo(nowValues.histogram,2),
            roundTo(nowValues.histoSum,2),
            tradetype,
            msgText
        ].join(', ');
        
        stream.write(str + require('os').EOL);
    } catch(exception) {
        logger.error('[trend log] ' + exception);
    }
}