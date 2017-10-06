var events = require('events');
var splitArray = require('split-array');
var log4js = require('log4js');
var logger = log4js.getLogger('ohlc-builder');

// CONFIG
const SPLIT_SIZE = 'ohlc:splitSize';
const Config = require("config-watch");
const CONFIG_FILE = './config/btcConfig.json';
let configWatch = new Config(CONFIG_FILE);
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

var selector = require('./btcSelector.js');
selector.getEmitter().on('event', listener);

var emitter = new events.EventEmitter();
exports.getEmitter = () => emitter;


function listener(args) {
  try {
    var argsResized = args.slice(args.length % splitSize + splitSize);

    // var coinChunks = splitArray(args, splitSize);
    var coinChunks = splitArray(argsResized, splitSize);
    
    // coinChunks = 
    // [
    //   [ {epoch, price, volume}, {epoch, price, volume},...(splitSize 개) ], 
    //   [ {epoch, price, volume}, {epoch, price, volume},...(splitSize 개) ],
    //   ... cnt = 12 hour 
    // ]
    //
    // [[coinChunk, ohlc], [coinChunk, ohlc], ...]
    var ohlcInfos = coinChunks.map((e) => makeOHLCfield(e));
    
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
  var coinInfo = JSON.parse(coins[coins.length -1]);
  const prices = coins.map(_ => JSON.parse(_).price);
  const volumes = coins.map(_ => JSON.parse(_).volume);

  coinInfo.date = minuteString(coinInfo.epoch);
  coinInfo.high = prices.reduce((e1, e2) => Math.max(e1,e2));
  coinInfo.low = prices.reduce((e1, e2) => Math.min(e1,e2));
  coinInfo.close = prices[coins.length-1];
  coinInfo.open = prices[0];
  coinInfo.volume = volumes.reduce((e1,e2) => (e1 + e2));
  return coinInfo;
}