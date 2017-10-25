var events = require('events');
var CronJob = require('cron').CronJob;

var format = require('string-format');
format.extend(String.prototype);
let numeral = require('numeral');

String.prototype.unquoted = function (){return this.replace (/(^")|("$)/g, '')}

// date, time conversion
var moment = require('moment');

const CRON_SCHEDULE = process.env.SELECTOR_CRON.unquoted();
const CURRENCY = process.env.CURRENCY;

var log4js = require('log4js');
var logger = log4js.getLogger('selector:' + CURRENCY.toLowerCase());

var emitter = new events.EventEmitter();
exports.getEmitter = () => emitter;

var redisClient = require("./redisClient.js");

const TIMEZONE = 'Asia/Seoul';
const TWENTY_MINUTES = 1200000;

let lastepoch = 0;

String.prototype.unquoted = function (){return this.replace (/(^")|("$)/g, '')}

var heartbeat = (res) => {
  const epoch = Date.now();
  if (epoch - lastepoch > TWENTY_MINUTES) {
    lastepoch = epoch;
    logger.debug("running. cron: {}, res size {}".format(CRON_SCHEDULE, res.length));
    let redisEpoch = JSON.parse(res[res.length-1]).epoch;

    if (epoch - redisEpoch > TWENTY_MINUTES) {
        let moment = require('moment');
        let note = require('./notifier.js');
        const v= {
            lastTime : moment(new Date(redisEpoch)).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm')
        };
        const f = 'Latest date in db is {lastTime}';
        note.danger(f.format(v), '*Check Database Status*');
    }
  }
};

var select = () => {
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
