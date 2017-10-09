var events = require('events');
var CronJob = require('cron').CronJob;

var format = require('string-format');
format.extend(String.prototype);

var log4js = require('log4js');
log4js.configure('./config/loggerConfig.json');
var log4js_extend = require("log4js-extend");
log4js_extend(log4js, {
  path: __dirname,
  format: "(@name:@line:@column)"
});
var logger = log4js.getLogger('selector');


// CONFIG
const CRON = 'selector:cron';
const CURRENCY = 'selector:currency';
var cronJob;
const ConfigWatch = require("config-watch");
const CONFIG_FILE = './config/trackerConfig.json';
let configWatch = new ConfigWatch(CONFIG_FILE);
let cronSchedule = configWatch.get(CRON);
let currency = configWatch.get(CURRENCY);

configWatch.on("change", (err, config) => {
    if (err) { throw err; }
    if(config.hasChanged(CRON)) {
      cronSchedule = config.get(CRON);
      cronJob.time = cronSchedule;
      logger.info("cronSchedule for selector has been changed to " + cronJob.time);
    }
});

var emitter = new events.EventEmitter();
exports.getEmitter = () => emitter;


var redisClient = require("./redisClient.js");

const TIMEZONE = 'Asia/Seoul';
const TEN_MINUTE = 600;

let lastepoch = 0;

var heartbeat = (res) => {
  const epoch = Math.round(Date.now() / 1000);
  if (epoch - lastepoch > TEN_MINUTE) {
    lastepoch = epoch;
    logger.debug("selector is running. cron: {}, res size {}".format(cronSchedule, res.length));
  } 
};

var select = () => {
  try {
    redisClient.zrange(currency, 0, -1, (err, res) => {
    if(err) { throw err; }
      emitter.emit('event', res);
      heartbeat(res);
    });
  } catch (exception) {
    logger.error("[select] exception: " + exception);
  }
};

cronJob = new CronJob(cronSchedule, select, null, true, TIMEZONE);
