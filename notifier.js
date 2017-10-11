var util = require("util");
var fs = require('fs');
var replaceall = require("replaceall");
var moment = require('moment');

var format = require('string-format');
format.extend(String.prototype);

const CURRENCY = 'currency';
const ConfigWatch = require("config-watch");
const CONFIG_FILE = './config/trackerConfig.json';
let configWatch = new ConfigWatch(CONFIG_FILE);
let currency = configWatch.get(CURRENCY);


// const BITHUMB_CURRENCY = 'BTC';
// const BITHUMB_URL = "https://api.bithumb.com/public/ticker/" + BITHUMB_CURRENCY;
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
const webhook = () => {
  var url;
  switch(currency) {
    case 'BTC':
      url = 'https://hooks.slack.com/services/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';
      break;
    case 'ETH':
      url= 'https://hooks.slack.com/services/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';
      break;
  }
  return url;
};


let post = slackPost.post(webhook());
post.setUsername('BITCOIN-BOT').setChannel('#bitcoin').enableFieldMarkdown();

const CHART_URL = 'http://bithumb-kykim791.c9users.io';

const EOL = require('os').EOL;

function sendToSlack(line, type=notiType.INFO, title){ 
  try {
    post
    .setColor(type.value)
    .setRichText('[{4}] {0}{2}```{1}{2}```{2}{3}'.format(title, line, EOL, CHART_URL,currency), true)
    .enableUnfurlLinks()
    .send((err) => { if (err) throw err; });
    
    log(line, type, title);
  } catch(exception) {
    logger.error(exception);
  }
}

function log(line, type, msg) {
  const m = replaceall(EOL, '; ',msg + ', ' + line);
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

// let IncomingWebhook = require('@slack/client').IncomingWebhook;
// let webhook = new IncomingWebhook(WEBHOOK_URL);
// let MarkDown = '\`\`\`';
