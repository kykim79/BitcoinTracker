let fs = require('fs');
let json2csv = require('json2csv');
let events = require('events');

let emitter = new events.EventEmitter();
exports.getEmitter = () => emitter;

const CURRENCY = process.env.CURRENCY;
const currency = CURRENCY.toLowerCase();

const CHART_FIELDS = ['date', 'open', 'high', 'low', 'close', 'volume'];
const CHART_FIELD_NAMES = ['date', 'open', 'high', 'low', 'close', 'volume'];
const CHART_FILENAME = process.env.CHART_DATA + currency + '/CandleData.csv';
const CONFIG = process.env.CONFIG;  // configuration folder with '/'

// LOGGER
let log4js = require('log4js');
log4js.configure(CONFIG + 'loggerConfig.json');
let log4js_extend = require('log4js-extend');
log4js_extend(log4js, {
    path: __dirname,
    format: '(@name:@line:@column)'
});
const logger = log4js.getLogger('chartfeeder:' + currency);

let ohlcBuilder = require('./ohlcBuilder.js');
ohlcBuilder.getEmitter().on('event', listener);

logger.debug('chart file ' + CHART_FILENAME);

function listener(args) {
    try {
        args.forEach((item, index) => writeChartData(item, index === 0, index));
        logger.debug('Feeding ' + args.length + ' rows');
    } catch(e) {
        logger.error(e);
    }
}

function writeChartData(data, firstLine) {
    let opts = {
        data: JSON.parse(JSON.stringify(data)),
        fields: CHART_FIELDS,
        fieldNames: CHART_FIELD_NAMES,
        hasCSVColumnTitle: firstLine,
        quotes: ''
    };

    const line = json2csv(opts) + require('os').EOL;

    if(firstLine) {
        fs.writeFileSync(CHART_FILENAME, line, 'utf-8');
    } else {
        fs.appendFileSync(CHART_FILENAME, line, 'utf-8');
    }
}
