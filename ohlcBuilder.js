var events = require('events');
var splitArray = require('split-array');

var format = require('string-format');
format.extend(String.prototype);

let SPLIT_SIZE = Number(process.env.SPLIT_SIZE);

const CURRENCY = process.env.CURRENCY;

var log4js = require('log4js');
var logger = log4js.getLogger('ohlcBuilder:'  + CURRENCY.toLowerCase());

var moment = require('moment');
require('moment-timezone');
var minuteString = (epoch) => moment(new Date(epoch)).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm');

var selector = require('./selector.js');
selector.getEmitter().on('event', listener);

var emitter = new events.EventEmitter();
exports.getEmitter = () => emitter;

var lastHeadCoins = [];

function listener(args) {
  try {

    const coinChunks = splitArray(shiftCoins(args), SPLIT_SIZE);
    // coinChunks = 
    // [
    //   [ {epoch, price, volume}, {epoch, price, volume},...(splitSize 개) ], 
    //   [ {epoch, price, volume}, {epoch, price, volume},...(splitSize 개) ],
    // ]
    
    lastHeadCoins = coinChunks.map(e => e[0]);

    var ohlcInfos = coinChunks.map((e) => makeOHLCfield(e));
    // ohlcInfos  = 
    // [
    //    {epoch, price, volume, date, high, low, close, open},
    //    {epoch, price, volume, date, high, low, close, open}
    //]

    validateDates(ohlcInfos);

    emitter.emit('event', ohlcInfos);
  } catch(e) {
    logger.error(e);
  }
}

// 1st: 1,2,3,4,5,6,7,8,10 =>     [1,2] [3,4] [5,6] 
// 2nd: 4,5,6,7,8,10,11,12,13 =>  [5,6] [7,8] [9,10]
// 3nd: 6,7,8,10,11,12,13 =>      [7,8] [9,10] [11,12] 
function shiftCoins(args) {
  var coins = args;

  if (lastHeadCoins.length > 0) {
    const firstHeadIndex = args.findIndex(e => lastHeadCoins.includes(e));
    coins = args.filter((e,index) => index >= firstHeadIndex);
  }

  const count = coins.length % SPLIT_SIZE;
  coins.splice(-count, count);
  return coins;
}

function makeOHLCfield(coins) {
  const coinInfos = coins.map(_ => JSON.parse(_));
  const coinInfo = coinInfos[coinInfos.length - 1];

  const prices = coinInfos.map(_ => _.price);
  const volumes = coinInfos.map(_ => _.volume);

  coinInfo.date = minuteString(coinInfo.epoch);
  coinInfo.high = prices.reduce((e1, e2) => Math.max(e1, e2));
  coinInfo.low = prices.reduce((e1, e2) => Math.min(e1, e2));
  coinInfo.close = prices[prices.length - 1];
  coinInfo.open = prices[0];
  coinInfo.volume = volumes.reduce((e1, e2) => (e1 + e2));
  return coinInfo;
}

function validateDates(ohlcInfos) {
  // to verify dates
  if (ohlcInfos.length > 4) {
    logger.debug('table[{0}], ({1} ~ {2}, {3}, {4})'
      .format(ohlcInfos.length,
        ohlcInfos[0].date,
        ohlcInfos[ohlcInfos.length - 3].date.substring(8),
        ohlcInfos[ohlcInfos.length - 2].date.substring(8),
        ohlcInfos[ohlcInfos.length - 1].date.substring(8)));
  }
}
