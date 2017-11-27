const events = require('events');
const CronJob = require('cron').CronJob;

const format = require('string-format');
format.extend(String.prototype);

const CRON_SCHEDULE = process.env.CRON_SCHEDULE;
const CURRENCY = process.env.CURRENCY;
const currency = CURRENCY.toLowerCase();

// CONFIGRATION && LOGGER
const CONFIG = process.env.CONFIG;  // configuration folder with '/'

const json = require('json-file');
let log4js = require('log4js');
const LOG = process.env.LOG;
const LOGGER_CONFIGFILE = process.env.LOGGER_CONFIGFILE;
const LOGGER_OUTFILE = process.env.LOGGER_OUTFILE;
let logCf = new json.read(CONFIG + LOGGER_CONFIGFILE).data;
logCf.appenders.file.filename = LOG + currency + '/' + LOGGER_OUTFILE;
log4js.configure(logCf);
let log4js_extend = require('log4js-extend');
log4js_extend(log4js, {
    path: __dirname,
    format: '(@name:@line:@column)'
});
const logger = log4js.getLogger('selector:' + currency);
const moment = require('moment');
const note = require('./notifier.js');

let emitter = new events.EventEmitter();
exports.getEmitter = () => emitter;

const redisClient = require('./redisClient.js');

const TIMEZONE = 'Asia/Seoul';
const THIRTY_MINUTES = 1800000;     // 30 min * 60 sec * 1000 milsec

let lastepoch = 0;

let heartbeat = (res) => {
    const epoch = Date.now();
    if (epoch - lastepoch > THIRTY_MINUTES) {
        lastepoch = epoch;
        const redisEpoch = JSON.parse(res[res.length-1]).epoch;
        const lastTime =  moment(new Date(redisEpoch)).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm');
        logger.debug('running. cron: {}, res size {}, {}'.format(CRON_SCHEDULE, res.length, lastTime));
        if (epoch - redisEpoch > THIRTY_MINUTES) {
            const f = 'Latest date in db is {}';
            note.danger(f.format(lastTime), 'Check Database Status');
        }
    }
};

let select = () => {
    try {
        redisClient.zrange(CURRENCY, 0, -1, (err, res) => {
            if(err) { throw err; }
            emitter.emit('event', res);
            heartbeat(res);
        });
    } catch (e) {
        logger.error(e);
    }
};

select(); // immediate run once when started..

new CronJob(CRON_SCHEDULE, select, null, true, TIMEZONE);
