var util = require("util");
var fs = require('fs');
var replaceall = require("replaceall");
var moment = require('moment');

var format = require('string-format');
format.extend(String.prototype);


const BITHUMB_CURRENCY = 'BTC';
const BITHUMB_URL = "https://api.bithumb.com/public/ticker/" + BITHUMB_CURRENCY;
const TIMEZONE = 'Asia/Seoul';

// LOGGER
var log4js = require('log4js');
var logger = log4js.getLogger('notifier');

let notiType = require('./notiType.js');

exports.info = (line,msg='Info') => {
  sendToSlack(line, notiType.INFO,msg);
};

exports.warn = (line,msg='Warn') => {
  sendToSlack(line, notiType.WARN,msg);
};

exports.danger = (line,msg='Danger') => {
  sendToSlack(line, notiType.DANGER,msg);
  
};

let slackPost = require('slackpost');
const WEBHOOK_URL = 'https://hooks.slack.com/services/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' || ''; //see section above on sensitive data
const IconURL = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Bitcoin.svg/440px-Bitcoin.svg.png";

let post = slackPost.post(WEBHOOK_URL);
post.setUsername('BITCOIN-BOT').setChannel('#bitcoin').enableFieldMarkdown().setIconURL(IconURL);

const CHART_URL = 'http://bithumb-kykim791.c9users.io';

const EOL = require('os').EOL;

function sendToSlack(line, type=notiType.INFO, title){ 
  try {
    post
    .setColor(type.value)
    .setRichText('{0}{2}```{1}{2}```{2}{3}'.format(title, line, EOL, CHART_URL), true)
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
