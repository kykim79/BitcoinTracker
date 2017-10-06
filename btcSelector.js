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
const Config = require("config-watch");
const CONFIG_FILE = './config/btcConfig.json';
let configWatch = new Config(CONFIG_FILE);
let cronSchedule = configWatch.get(CRON);

configWatch.on("change", (err, config) => {
    if (err) { throw err; }
    if(config.hasChanged(CRON)) {
      cronSchedule = config.get(CRON);
      logger.info("cronSchedule for selector has been changed to " + cronSchedule);
    }
});

var emitter = new events.EventEmitter();
exports.getEmitter = () => emitter;


var redis = require("redis");
var redisClient = redis.createClient();

redisClient.on('error', (err) => logger.error(err) );

const TIMEZONE = 'Asia/Seoul';
const BITHUMB_CURRENCY = 'BTC';
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
    redisClient.zrange(BITHUMB_CURRENCY, 0, -1, (err, res) => {
      if(err) {
        logger.error(err);
      }
      emitter.emit('event', res);
      heartbeat(res);
    });
  } catch (exception) {
    logger.error("[select] exception: " + exception);
  }
};

new CronJob(cronSchedule, select, null, true, TIMEZONE);
