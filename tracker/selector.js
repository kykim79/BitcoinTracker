let events = require('events');
let CronJob = require('cron').CronJob;

let format = require('string-format');
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

let emitter = new events.EventEmitter();
exports.getEmitter = () => emitter;

let redisClient = require('./redisClient.js');

const TIMEZONE = 'Asia/Seoul';
const TWENTY_MINUTES = 1200000;

let lastepoch = 0;

// String.prototype.unquoted = function (){return this.replace (/(^")|("$)/g, '');};

let heartbeat = (res) => {
    const epoch = Date.now();
    if (epoch - lastepoch > TWENTY_MINUTES) {
        lastepoch = epoch;
        logger.debug('running. cron: {}, res size {}'.format(CRON_SCHEDULE, res.length));
        let redisEpoch = JSON.parse(res[res.length-1]).epoch;

        if (epoch - redisEpoch > TWENTY_MINUTES) {
            let moment = require('moment');
            let note = require('./notifier.js');
            const v= {
                lastTime : moment(new Date(redisEpoch)).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm')
            };
            const f = 'Latest date in db is {lastTime}';
            note.danger(f.format(v), 'Check Database Status');
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
