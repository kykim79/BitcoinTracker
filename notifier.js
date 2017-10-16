// var util = require("util");
// var fs = require('fs');
var replaceall = require("replaceall");
// var moment = require('moment');

var format = require('string-format');
format.extend(String.prototype);

// CONFIG
const ConfigWatch = require("config-watch");
const CONFIG_FILE = './config/trackerConfig.json';
let configWatch = new ConfigWatch(CONFIG_FILE);
const CURRENCY = configWatch.get('currency');

const NOTIFY_FILE = './config/notifyConfig.json';
const notifyWatch = new ConfigWatch(NOTIFY_FILE);
const WEBHOOK = notifyWatch.get('webHook');
// const CHART = notifyWatch.get('chart');

const TIMEZONE = 'Asia/Seoul';

// LOGGER
var log4js = require('log4js');
var logger = log4js.getLogger('notifier-' + CURRENCY);

let notiType = require('./notiType.js');

exports.info = (line, msg) => {
  sendToSlack(line, notiType.INFO, msg);
};

exports.warn = (line, msg) => {
  sendToSlack(line, notiType.WARN, msg);
};

exports.danger = (line, msg) => {
  sendToSlack(line, notiType.DANGER, msg);
};

let slackPost = require('slackpost');
let post = slackPost.post(WEBHOOK);
post.setUsername(CURRENCY).enableFieldMarkdown();

const EOL = require('os').EOL;

function sendToSlack(line, type=notiType.INFO, title){ 
  try {
    post
    .setColor(type.value)
    .setRichText('{0}{2}```{1}{2}```{2}'.format(title, line, EOL), true)
    .enableUnfurlLinks()
    .send((err) => { if (err) throw err; });
    
    log(line, type, title);
  } catch(exception) {
    logger.error(exception);
  }
}

function log(line, type, msg) {
  const m = replaceall(EOL, '; ', msg + ', ' + line);
  switch (type.value) {
  case notiType.INFO:
    logger.info(m);
    break;
  case notiType.WARN:
    logger.warn(m);
    break;
  case notiType.DANGER:
    logger.error(m);
    break;
  default :
    logger.debug(m);
    break;
  } 
}
