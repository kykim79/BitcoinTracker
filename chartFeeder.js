var fs = require('fs');
var json2csv = require('json2csv');
var events = require('events');

// LOGGER
var log4js = require('log4js');
var logger = log4js.getLogger('chartFeeder:' + process.env.CURRENCY.toLowerCase());

var emitter = new events.EventEmitter();
exports.getEmitter = () => emitter;

const CHART_FIELDS = ['date', 'open', 'high', 'low', 'close', 'volume'];
const CHART_FIELD_NAMES = ['date', 'open', 'high', 'low', 'close', 'volume'];
const FILE_NAME = process.env.CHART_DATA;

var ohlcBuilder = require('./ohlcBuilder.js');
ohlcBuilder.getEmitter().on('event', listener);

function listener(args) {
  try {
    args.forEach((item, index) => writeChartData(item, index == 0, index));
    logger.debug('Feeding ' + args.length + ' rows');
  } catch(e) {
    logger.error(e);
  }
}

function writeChartData(data, firstLine) {
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
    fs.appendFileSync(FILE_NAME, line, 'utf-8');  
  }
}
