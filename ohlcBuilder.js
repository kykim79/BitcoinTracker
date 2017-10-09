var events = require('events');
var splitArray = require('split-array');
var log4js = require('log4js');
var logger = log4js.getLogger('ohlc-builder');

// CONFIG
const SPLIT_SIZE = 'ohlc:splitSize';
const ConfigWatch = require("config-watch");
const CONFIG_FILE = './config/trackerConfig.json';
let configWatch = new ConfigWatch(CONFIG_FILE);
let splitSize = configWatch.get(SPLIT_SIZE);

var moment = require('moment');
require('moment-timezone');
var minuteString = (epoch) => moment(new Date(epoch)).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm');

configWatch.on("change", (err, config) => {
    if (err) { throw err; }
    if(config.hasChanged(SPLIT_SIZE)) {
      splitSize = config.get(SPLIT_SIZE);
      logger.warn("ohlc:splitsize has been changed to "+splitSize);
    }
});

var selector = require('./selector.js');
selector.getEmitter().on('event', listener);

var emitter = new events.EventEmitter();
exports.getEmitter = () => emitter;

// 1st: 1,2,3,4,5,6,7,8,10 =>     [1,2] [3,4] [5,6] 
// 2nd: 4,5,6,7,8,10,11,12,13 =>  [5,6] [7,8] [9,10]
// 3nd: 6,7,8,10,11,12,13 =>      [7,8] [9,10] [11,12] 
var heads = [];

function listener(args) {
  try {

    var coins = args;
    
    if(heads.length > 0) {
      var headFound = false;
      coins = args.map(e => {
        if(headFound) {
          return e;
        } else {
          if(heads.includes(e)) {
            headFound = true;
            return e;
          }
        }

      }).filter(e => e != undefined);
    } 
    
    var coinChunks = splitArray(coins, splitSize);
    heads = coinChunks.map(e => e[0]);
    
    // coinChunks = 
    // [
    //   [ {epoch, price, volume}, {epoch, price, volume},...(splitSize 개) ], 
    //   [ {epoch, price, volume}, {epoch, price, volume},...(splitSize 개) ],
    //   ... cnt = 12 hour 
    // ]
    //
    // [[coinChunk, ohlc], [coinChunk, ohlc], ...]
    var ohlcInfos = coinChunks.map((e) => makeOHLCfield(e));

    // to verify dates
    var dateFrom = moment(new Date(ohlcInfos[0].epoch)).tz('Asia/Seoul').format('MM-DD HH:mm');
    var dateTo3 = moment(new Date(ohlcInfos[heads.length-3].epoch)).tz('Asia/Seoul').format('DD HH:mm');
    var dateTo2 = moment(new Date(ohlcInfos[heads.length-2].epoch)).tz('Asia/Seoul').format('DD HH:mm');
    var dateTo1 = moment(new Date(ohlcInfos[heads.length-1].epoch)).tz('Asia/Seoul').format('DD HH:mm');
    logger.debug('table[' + ohlcInfos.length + '], (' + dateFrom
                + '~' + dateTo3 + ',' + dateTo2 + ',' + dateTo1 + ')');
  
    // ohlcInfos  = 
    // [
    //    {epoch, price, volume, date, high, low, close, open},
    //    {epoch, price, volume, date, high, low, close, open}
    //   ... cnt = 12 hour / 10
    //]
    emitter.emit('event', ohlcInfos);
  } catch(exception) {
    logger.error(exception);
  }
}

function makeOHLCfield(coins){
  //var coinInfo = JSON.parse(coins[coins.length -1]);
  
  const coinInfos = coins.map(_ => JSON.parse(_));
  const coinInfo = coinInfos[coinInfos.length - 1];
  
  const prices = coinInfos.map(_ => _.price);
  const volumes = coinInfos.map(_ => _.volume);

  coinInfo.date = minuteString(coinInfo.epoch);
  coinInfo.high = prices.reduce((e1, e2) => Math.max(e1,e2));
  coinInfo.low = prices.reduce((e1, e2) => Math.min(e1,e2));
  coinInfo.close = prices[prices.length - 1];
  coinInfo.open = prices[0];
  coinInfo.volume = volumes.reduce((e1,e2) => (e1 + e2));
  return coinInfo;
}