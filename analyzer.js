var format = require('string-format');
format.extend(String.prototype);
const CURRENCY = process.env.CURRENCY;
var fs = require('fs');

let pad = require('pad');
let numeral = require('numeral');
let roundTo = require('round-to');
// var replaceall = require("replaceall");

// date, time conversion
var moment = require('moment');

var MACD = require('technicalindicators').MACD;
const Stochastic = require('technicalindicators').Stochastic;

// Stream Roller
var rollers = require('streamroller');
var stream = new rollers.RollingFileStream('./log/' + CURRENCY.toLowerCase() + '/trend.log', 30000, 2);

const CONFIG_FILE = './config/' + CURRENCY.toLowerCase() + '/trackerConfig.json';

const Watcher = require('watch-files');
var watcher = Watcher({
    interval: '0.1s'
})
watcher.add(CONFIG_FILE);

var json = require('json-file');
var readAnalyzer = (path) => new json.read(path).get('analyzer');

var analyzer  = readAnalyzer(CONFIG_FILE);

watcher.on('change', (info) => {
  const a = readAnalyzer(info.path);
analyzer.histogram = roundTo(analyzer.histoPercent * (analyzer.sellPrice + analyzer.buyPrice) / 2, 2);
  const v = 'Sell:{sell}, histo(div):{histo}\nBuy :{buy}, gap:{gap}%'.format({
    sell : npad(a.sellPrice),
    buy  : npad(a.buyPrice),
    gap  : npercent(a.gapAllowance),
    histo: npercent(a.histogram)
  });
  logger.info(v, '*Config Changed*');
});

// CONFIG
const ANALYZER = 'analyzer';

let npad = (number) => (number < 1000000) ? pad(4, numeral((number)).format('0,0')) : pad(9, numeral((number)).format('0,0'));
let npercent = (number) => numeral(number * 100).format('0,0.00') + '%';

const histoCount  = 5;   // variable for ignoring if too small changes

// LOGGER
let log4js = require('log4js');
let logger = log4js.getLogger('analyzer:' + CURRENCY.toLowerCase());

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
    const highs = ohlcs.map(_ => _.high);
    const lows = ohlcs.map(_ => _.low);

  var macdInput = {
    values            : closes,
    fastPeriod        : 12,
    slowPeriod        : 26,
    signalPeriod      : 9 ,
    SimpleMAOscillator: false,
    SimpleMASignal    : false
  };

  var macds = MACD.calculate(macdInput);

    let stockInput = {
        high: highs,
        low: lows,
        close: closes,
        period: 14,
        signalPeriod: 3
    };

    var stochastic = Stochastic.calculate(stockInput);

    // console.log('len ' + stochastic.length);
    // console.log(stochastic);
// JSON.parse(JSON.stringify(e)) + '\n';
//         fs.appendFileSync('./log/stochastic.log', j, 'utf-8');
//     });

    let tableSize = macds.length;
  if (isFirstTime) {
    const v= {
        sell : npad(analyzer.sellPrice),
        buy  : npad(analyzer.buyPrice),
        size : tableSize,
        gap  : npercent(analyzer.gapAllowance),
        now  : npad(ohlcs[ohlcs.length-1].close),
        histo: npercent(analyzer.histoPercent)
    };
    const f = 'Sell:{sell}  tblSz :{size}\n' +
            'Now :{now}  gap :{gap}\n' +
            'Buy :{buy}  histo(div):{histo}' +
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
  nowValues.dNow = roundTo(stochastic[stochastic.length - 1].d,3);
  nowValues.kNow = roundTo(stochastic[stochastic.length - 1].k,3);
  nowValues.dLast = roundTo(stochastic[stochastic.length - 2].d,3);
  nowValues.kLast = roundTo(stochastic[stochastic.length - 2].k,3);
  nowValues.tradeType = '';
  nowValues.msgText = '';
  nowValues.histoAvr = roundTo((macds.slice(tableSize - histoCount).map(_ => _.histogram).reduce((e1, e2) => e1 + Math.abs(e2)))/histoCount,2);

  analyzeHistogram(nowValues);
  analyzeStochastic(nowValues);

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

function analyzeHistogram(nV) {
    if (nV.histoAvr > analyzer.histogram) {
        var nowHistogram = nV.histogram;
        var lastHistogram = macds[tableSize - 2].histogram;
        if (lastHistogram >= 0 && nowHistogram <= 0 &&
            (Math.abs(analyzer.sellPrice - nV.close) / nV.close) < analyzer.gapAllowance) {
            nV.tradeType = TradeType.SELL;
            nV.msgText = (nV.close >= analyzer.sellPrice) ? '*Over, Should SELL*' : '*SELL POINT*';
        }
        else if (lastHistogram <= 0 && nowHistogram >= 0 &&
            (Math.abs(analyzer.buyPrice - nV.close) / nV.close) < analyzer.gapAllowance) {
            nV.tradeType = TradeType.BUY;
            nV.msgText = (nV.close <= analyzer.buyPrice) ? '*Under, Should BUY*' : '*BUY POINT*';
        }
        if (nV.msgText) {
            informTrade(nV);
        }
    }
    else {
        logger.debug('last [' + histoCount + '] histoAverage '  + nV.histoAvr  + ' < ' + analyzer.histogram +' histoPercent : '  +  npercent(analyzer.histoPercent));
    }
}

function analyzeStochastic(nv) {
    if (nv.dLast >= 80  && nv.kLast >= 80) {
        if (nv.dNow < 80 || nv.kNow < 80) {
            nv.tradeType = TradeType.SELL;
            nv.msgText = '*Stochastic SELL*'
            informTrade(nv);
            logger.debug('dLast ' + nv.dnow + 'kLast ' + nv.kLast);
            logger.debug('dNow  ' + nv.dnow + 'kNow  ' + nv.kNow);
        }
    }
    else if (nv.dLast <= 20  && nv.kLast <= 20) {
        if (nv.dNow > 20 || nv.kNow > 20) {
            nv.tradeType = TradeType.SELL;
            nv.msgText = '*Stochastic BUY*'
            informTrade(nv);
            logger.debug('dLast ' + nv.dnow + 'kLast ' + nv.kLast);
            logger.debug('dNow  ' + nv.dnow + 'kNow  ' + nv.kNow);
        }
    }
}

function informTrade(nowValues) {
  const now = nowValues.close;
  const target = ( nowValues.tradeType == TradeType.SELL) ? analyzer.sellPrice : analyzer.buyPrice;
  const v= {
      nowNpad     : npad(now),
      buysell     : (nowValues.tradeType == 'SELL') ? 'SELL' : 'BUY ',
      targetNpad  : npad(target),
      gap         : npad(now - target),
      gapPcnt     : npercent((now - target)/target),
      volume      : numeral(nowValues.volume).format('0,0'),
      histo       : npercent(nowValues.histoPercent),
      histoAvr    : npad(nowValues.histoAvr)
  };
  const f = 'Now :{nowNpad}  vol:{volume}\n' +
        '{buysell}:{targetNpad}  gap:{gap} {gapPcnt}%\n' +
        'histoAvr:{histoAvr}  histo(div):{histo}%';

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
      nowValues.histogram,
      nowValues.histoAvr,
      nowValues.dNow,
      nowValues.kNow,
      nowValues.tradeType,
      nowValues.msgText
    ].join(', ');
    stream.write(str + require('os').EOL);
  } catch(e) {
    logger.error(e);
  }
}
