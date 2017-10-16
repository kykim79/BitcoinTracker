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
var stream = new rollers.RollingFileStream('./log/trend.log', 40000, 2);

// CONFIG
const ANALYZER = 'analyzer';
const ConfigWatch = require("config-watch");
const CONFIG_FILE = './config/trackerConfig.json';
let configWatch = new ConfigWatch(CONFIG_FILE);
let analyzer = configWatch.get(ANALYZER);
const histoCount  = 5;   // variable for ignoring if too small changes

const CURRENCY = configWatch.get('currency');

configWatch.on("change", (err, config) => {
    if (err) { throw err; }
    if (config.hasChanged(ANALYZER)) {
        analyzer = config.get(ANALYZER);
        const v= {
            sell : npad(analyzer.sellPrice),
            buy  : npad(analyzer.buyPrice),
            gap  : roundTo(analyzer.gapAllowance * 100,2),
            histo: numeral(analyzer.histogram).format('0,0.0')
        };
        const f = 'Sell:{sell}  histo:{histo}\nBuy :{buy}  gap:{gap}\%';
        note.info(f.format(v), '*Config Change*');
    }
});

// LOGGER
let log4js = require('log4js');
let logger = log4js.getLogger('analyzer ' + CURRENCY);

let npad = (number) => pad(9, numeral((number)).format('0,0'));

let note = require('./notifier.js');

let TradeType = require('./tradeType.js');

let isFirstTime = true; // inform current setting when this module is started

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

    let tableSize = macds.length;
    if (isFirstTime) {
        const v= {
            sell : npad(analyzer.sellPrice),
            buy  : npad(analyzer.buyPrice),
            size : tableSize,
            gap  : roundTo(analyzer.gapAllowance * 100,2),
            now  : npad(ohlcs[ohlcs.length-1].close),
            histo : analyzer.histogram
        };
        const f = 'Sell:{sell}, tblSz:{size}\n' +
            'Now :{now}, gap:{gap}\%\n' +
            'Buy :{buy}, histo:{histo}' +
            '';
        note.info(f.format(v), '*_STARTED_*');
        isFirstTime = false;
        
    }
    if (tableSize < histoCount) {
        return;
    }
 
    var nowValues = ohlcs[ohlcs.length - 1];
    nowValues.MACD = macds[tableSize - 1].MACD;
    nowValues.signal = macds[tableSize - 1].signal;
    nowValues.histogram = macds[tableSize - 1].histogram;
    nowValues.tradeType = '';
    nowValues.msgText = '';
    
    nowValues.histoAvr = roundTo((macds.slice(tableSize - histoCount).map(_ => _.histogram).reduce((e1, e2) => e1 + Math.abs(e2)))/histoCount,1);
    
    if (nowValues.histoAvr > analyzer.histogram) {
        var nowHistogram = nowValues.histogram;
        var lastHistogram = macds[tableSize - 2].histogram;
        if (lastHistogram >= 0 && nowHistogram <= 0 && 
            (Math.abs(analyzer.sellPrice - nowValues.close) / nowValues.close) < analyzer.gapAllowance) {
            nowValues.tradeType = TradeType.SELL;
            nowValues.msgText = (nowValues.close >= analyzer.sellPrice) ? '*Over, Should SELL*' : '*SELL POINT*';
        }
        else if (lastHistogram <= 0 && nowHistogram >= 0 &&
            (Math.abs(analyzer.buyPrice - nowValues.close) / nowValues.close) < analyzer.gapAllowance) {
            nowValues.tradeType = TradeType.BUY;
            nowValues.msgText = (nowValues.close <= analyzer.buyPrice) ? '*Under, Should BUY*' : '*BUY POINT*';
        }
        if (nowValues.msgText) {
            informTrade(nowValues);
        }
    }
    else {
        logger.debug('last histogram [' + histoCount + '] average '  +  nowValues.histoAvr  + ' is smaller than ' + analyzer.histogram);
    }
    if (!nowValues.msgText) {
        if (nowValues.close > analyzer.sellPrice) {
            nowValues.tradeType = TradeType.SELL;
            nowValues.msgText = '_Going UP UP_';
            informTrade(nowValues);
        } 
        else if (nowValues.close < analyzer.buyPrice) {
            nowValues.tradeType = TradeType.BUY;
            nowValues.msgText = '_Going DOWN_';
            informTrade(nowValues);
        }
    }
    keepLog(nowValues);
}

function informTrade(nowValues) {
    const now = nowValues.close;
    const target = ( nowValues.tradeType == TradeType.SELL) ? analyzer.sellPrice : analyzer.buyPrice;
    const v= {
        nowNpad     : npad(now),
        buysell     : (nowValues.tradeType == 'SELL') ? 'SELL' : 'BUY ',
        targetNpad  : npad(target),
        gap         : npad(now - target),
        volume      : numeral(nowValues.volume).format('0,0'),
        histo       : numeral(nowValues.histogram).format('0,0.0'),
        histoAvr    : numeral(nowValues.histoAvr).format('0,0.0')
    };
    const f = 'Now :{nowNpad} vol:{volume}\n' +
        '{buysell}:{targetNpad} gap:{gap}\n' +
        'histo:{histo} histoAvr:{histoAvr}';

    note.danger(f.format(v), nowValues.msgText);
}

function keepLog(nowValues) {

    try {
        let str = [
            CURRENCY,
            moment(new Date(nowValues.epoch)).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm'),
            nowValues.open, 
            nowValues.high, 
            nowValues.low, 
            nowValues.close,
            roundTo(nowValues.volume,2),
            roundTo(nowValues.MACD,2),
            roundTo(nowValues.signal,2),
            roundTo(nowValues.histogram,2),
            nowValues.histoAvr,
            nowValues.tradeType,
            nowValues.msgText
        ].join(', ');
        stream.write(str + require('os').EOL);
    } catch(e) {
        logger.error(e);
    }
}
