var format = require('string-format');
format.extend(String.prototype);

let pad = require('pad');
let numeral = require('numeral');
let roundTo = require('round-to');
// var replaceall = require("replaceall");

// date, time conversion
var moment = require('moment');

var MACD = require('technicalindicators').MACD;

// Stream Roller
var rollers = require('streamroller');
var stream = new rollers.RollingFileStream('./log/trend.log', 20000, 2);

// CONFIG
const ANALYZER = 'analyzer';
const ConfigWatch = require("config-watch");
const CONFIG_FILE = './config/trackerConfig.json';
let configWatch = new ConfigWatch(CONFIG_FILE);
let analyzer = configWatch.get(ANALYZER);

const CURRENCY = configWatch.get('currency');

configWatch.on("change", (err, config) => {
    if (err) { throw err; }
    if (config.hasChanged(ANALYZER)) {
        analyzer = config.get(ANALYZER);
        note.warn('buy:{buyPrice}, sell:{sellPrice}, divergence:{divergence}'.format(analyzer),'*Config Change*');
    }
});

// LOGGER
let log4js = require('log4js');
let logger = log4js.getLogger('analyzer ' + CURRENCY);

let npad = (number) => pad(9, numeral((number)).format('0,0'));

let note = require('./notifier.js');

let TradeType = require('./tradeType.js');

let isFirstTime = true; // inform current setting when this module is started
const aFewCount  = 8;   // variable for ignoring if too small changes

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
    var tradeType = '';
    var msgText = '';

    let tableSize = macds.length;
    if (isFirstTime) {
        const v= {
            sell : npad(analyzer.sellPrice),
            buy  : npad(analyzer.buyPrice),
            size : tableSize,
            now  : npad(ohlcs[ohlcs.length-1].close),
            histoSum    : numeral(analyzer.divergence).format('0,0')
        };
        const f = 'Sell:{sell}, tblSz:{size}\n' +
            'Buy :{buy}, div:{histoSum}\n' +
            'Now :{now}' +
            '';
        note.info(f.format(v), '*_STARTED_*');
        isFirstTime = false;
        
    }
    if (tableSize < aFewCount) {
        return;
    }
 
    var nowValues = ohlcs[ohlcs.length - 1];
    nowValues.MACD = macds[tableSize - 1].MACD;
    nowValues.signal = macds[tableSize - 1].signal;
    nowValues.histogram = macds[tableSize - 1].histogram;
    
    nowValues.histoSum = macds.slice(tableSize - aFewCount).map(_ => _.histogram).reduce((e1, e2) => e1 + Math.abs(e2));
    
    if (nowValues.histoSum > analyzer.divergence) {
        var nowHistogram = nowValues.histogram;
        var lastHistogram = macds[tableSize - 2].histogram;
        if (lastHistogram >= 0 && nowHistogram <= 0 && 
            (Math.abs(analyzer.sellPrice - nowValues.close) / nowValues.close) < analyzer.gapAllowance) {
            tradeType = TradeType.SELL;
            msgText = (nowValues.close >= analyzer.sellPrice) ? '*OverSELL, Should SELL*' : '*SELL POINT*';
        }
        else if (lastHistogram <= 0 && nowHistogram > 0 &&
            (Math.abs(analyzer.buyPrice - nowValues.close) / nowValues.close) < analyzer.gapAllowance) {
            tradeType = TradeType.BUY;          // tradeType is blank...why?
            msgText = (nowValues.close <= analyzer.buyPrice) ? '*UnderBUY, Should BUY*' : '*BUY POINT*';
        }
        if (msgText) {  // tradeType is not used because 
            informTrade(nowValues, tradeType, msgText);
        }
    }
    else {
        logger.debug('last ' + aFewCount + ' histogram '  +  roundTo(nowValues.histoSum, 2)  + ' < ' + analyzer.divergence );
    }
    if (!msgText) {
        if (nowValues.close > analyzer.sellPrice) {
            msgText = 'Going UP UP';
            informTrade(nowValues, TradeType.SELL, msgText);
        } 
        else if (nowValues.close < analyzer.buyPrice) {
            msgText = 'Going DOWN';
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
