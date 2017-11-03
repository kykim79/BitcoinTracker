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
var stream = new rollers.RollingFileStream('./log/trend.log', 30000, 2);

const CONFIG_FILE = './config/trackerConfig.json';

const Watcher = require('watch-files');
var watcher = Watcher({
    interval: '0.1s'
})
watcher.add(CONFIG_FILE);

var json = require('json-file');
var readAnalyzer = (path) => new json.read(path).get('analyzer');

const analyzer  = readAnalyzer(CONFIG_FILE);

watcher.on('change', (info) => {
  const a = readAnalyzer(info.path);
  const v = 'Sell:{sell}, histo:{histogram}\nBuy :{buy}, gap:{gap}%'.format({
    sell : npad(a.sellPrice),
    buy  : npad(a.buyPrice),
    gap  : roundTo(a.gapAllowance * 100,2),
    histogram: numeral(a.histogram).format('0,0.0')
  });

  logger.info(v, '*Config Changed*');
});

// CONFIG
const CURRENCY = process.env.CURRENCY;
const ANALYZER = 'analyzer';
const ConfigWatch = require("config-watch");
const CONFIG_FILE = './config/' + CURRENCY.toLowerCase() + '/trackerConfig.json';
let configWatch = new ConfigWatch(CONFIG_FILE);
let analyzer = configWatch.get(ANALYZER);
analyzer.histogram = roundTo(analyzer.histoPercent * (analyzer.sellPrice + analyzer.buyPrice) / 2, 2);

let npad = (number) => (number < 1000000) ? pad(4, numeral((number)).format('0,0')) : pad(9, numeral((number)).format('0,0'));
let npercent = (number) => numeral(number * 100).format('0,0.00') + '%';

const histoCount  = 5;   // variable for ignoring if too small changes

const CURRENCY = process.env.CURRENCY;

// LOGGER
let log4js = require('log4js');
let logger = log4js.getLogger('analyzer:' + CURRENCY.toLowerCase());

let npad = (number) => (number < 1000000) ? pad(4, numeral((number)).format('0,0')) : pad(9, numeral((number)).format('0,0'));

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
        gap  : npercent(analyzer.gapAllowance),
        now  : npad(ohlcs[ohlcs.length-1].close),
        histo: npercent(analyzer.histoPercent)
    };
    const f = 'Sell:{sell}  tblSz:{size}\n' +
            'Now :{now}  gap:{gap}%\n' +
            'Buy :{buy}  histo:{histo}' +
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

  nowValues.histoAvr = (macds.slice(tableSize - histoCount).map(_ => _.histogram).reduce((e1, e2) => e1 + Math.abs(e2)))/histoCount;

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
    //logger.debug('last histogram [' + histoCount + '] average '  +  roundTo(nowValues.histoAvr,2)  + ' is smaller than ' + roundTo(analyzer.histogram,2));
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
      gapPcnt     : npercent((now - target)/target),
      volume      : numeral(nowValues.volume).format('0,0'),
      histo       : npercent(nowValues.histoPercent),
      histoAvr    : npad(nowValues.histoAvr)
  };
  const f = 'Now :{nowNpad}  vol:{volume}\n' +
        '{buysell}:{targetNpad}  gap:{gap} {gapPcnt}%\n' +
        'histo:{histo}  histoAvr:{histoAvr}';

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
      roundTo(nowValues.histoAvr,2),
      nowValues.tradeType,
      nowValues.msgText
    ].join(', ');
    stream.write(str + require('os').EOL);
  } catch(e) {
    logger.error(e);
  }
}
