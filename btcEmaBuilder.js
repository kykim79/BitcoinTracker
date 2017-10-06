var ema = require('exponential-moving-average');
var fs = require('fs');
var json2csv = require('json2csv');
var events = require('events');
var zip = require('zip-array').zip_longest;

// LOGGER
var log4js = require('log4js');
var logger = log4js.getLogger('ema-builder');

// CONFIG
const EMA_SIZE = 'ema:emaSize';
const Config = require("config-watch");
const CONFIG_FILE = './config/btcConfig.json';
let configWatch = new Config(CONFIG_FILE);
let emaSize = configWatch.get(EMA_SIZE);

configWatch.on("change", (err, config) => { // great !! 
  if (err) { throw err; }
  if(config.hasChanged(EMA_SIZE)) {
      emaSize = config.get(EMA_SIZE);
      logger.info("emaSize has been changed in config.");
  }
});

var emitter = new events.EventEmitter();
exports.getEmitter = () => emitter;

const TIMEZONE = 'Asia/Seoul';

const CHART_FIELDS = ['date', 'open', 'high', 'low', 'close', 'volume'];
const CHART_FIELD_NAMES = ['date', 'open', 'high', 'low', 'close', 'volume'];
const FILE_NAME = './stockchart/public/CandleData2.csv';

var ohlcBuilder = require('./btcOhlcBuilder.js');
ohlcBuilder.getEmitter().on('event', listener);

function listener(args) {
  logger.debug('emaBuilder arg size ' + args.length);
  if(args.length < emaSize) {
    return;
  }
  
  try {
    var emaResult = ema(args.map(_ => _.price), emaSize); // ema(20) 산출 (앞에서부터 최신순)
    var zippedInfos = zip(args.slice().reverse(), emaResult.reverse());
    var emaAppendedInfos = zippedInfos.map(_=> { 
      _[0].ema = Number(_[1]); 
      return _[0]; 
    }).reverse();
    
    emaAppendedInfos.forEach((item, index) => writeChartData(item, index == 0, index));
    logger.debug('# of columns ' + emaAppendedInfos.length + ' with ema' + emaSize);
    emitter.emit('event', emaAppendedInfos.reverse().slice(0,emaSize));
  } catch(exception) {
    logger.error(exception);
  }
}

function writeChartData(data, firstLine, index) {
  var opts = { 
    data: JSON.parse(JSON.stringify(data)), 
    fields: CHART_FIELDS,
    fieldNames: CHART_FIELD_NAMES,
    hasCSVColumnTitle: firstLine,
    quotes: ''
  };
  
  const line = json2csv(opts) + require('os').EOL;
  
  if(firstLine) {
    fs.writeFileSync(FILE_NAME, line, 'utf-8');  
  } else {
  // } else if (index % 2 == 0) {
    fs.appendFileSync(FILE_NAME, line, 'utf-8');  
  }
}
