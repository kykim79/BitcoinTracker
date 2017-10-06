var ema = require('exponential-moving-average');
var fs = require('fs');
var json2csv = require('json2csv');
var events = require('events');
var zip = require('zip-array').zip_longest;

// LOGGER
var log4js = require('log4js');
var logger = log4js.getLogger('chart-feeder');

var emitter = new events.EventEmitter();
exports.getEmitter = () => emitter;

const TIMEZONE = 'Asia/Seoul';

const CHART_FIELDS = ['date', 'open', 'high', 'low', 'close', 'volume'];
const CHART_FIELD_NAMES = ['date', 'open', 'high', 'low', 'close', 'volume'];
const FILE_NAME = './chart/public/CandleData.csv';

var ohlcBuilder = require('./ohlcBuilder.js');
ohlcBuilder.getEmitter().on('event', listener);

function listener(args) {
  try {
    args.forEach((item, index) => writeChartData(item, index == 0, index));
    logger.debug('# of columns ' + args.length + ' sent to chart ');
  } catch(exception) {
    logger.error('[chartFeeder ] ' + exception);
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
