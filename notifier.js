// var util = require("util");
var fs = require('fs');
var replaceall = require("replaceall");
// var moment = require('moment');

var format = require('string-format');
format.extend(String.prototype);

// CONFIG
const CURRENCY = 'currency';
const ConfigWatch = require("config-watch");
const CONFIG_FILE = './config/trackerConfig.json';
let configWatch = new ConfigWatch(CONFIG_FILE);
let currency = configWatch.get(CURRENCY);

const NOTIFYLINK_FILE = './config/notifyLink.json';
let linkInfos = JSON.parse(fs.readFileSync(NOTIFYLINK_FILE));

let webHook;
let icon;
let chart;

linkInfos.forEach (function (e) {
  if (e.currency == currency) {
     webHook = e.webhook;
     icon = e.icon;
     chart = e.chart;
   }
});

const TIMEZONE = 'Asia/Seoul';

// LOGGER
var log4js = require('log4js');
var logger = log4js.getLogger('notifier');

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
let post = slackPost.post(webHook);
post.setUsername('BITHUMB-BOT').setChannel('#bitcoin').enableFieldMarkdown().setIconURL(icon);

const EOL = require('os').EOL;

function sendToSlack(line, type=notiType.INFO, title){ 
  try {
    post
    .setColor(type.value)
    .setRichText('{4}: {0}{2}```{1}{2}```{2}`{3}`'.format(title, line, EOL, chart, currency), true)
    .enableUnfurlLinks()
    .send((err) => { if (err) throw err; });
    
    log(line, type, title);
  } catch(exception) {
    logger.error(exception);
  }
}

function log(line, type, msg) {
  const m = replaceall(EOL, '; ', currency + ': ' + msg + ', ' + line);
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
