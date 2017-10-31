var replaceall = require("replaceall");

var format = require('string-format');
format.extend(String.prototype);

const CURRENCY = process.env.CURRENCY;
const WEBHOOK = process.env.WEBHOOK;

const TIMEZONE = 'Asia/Seoul';

// LOGGER
var log4js = require('log4js');
var logger = log4js.getLogger('notifier:' + CURRENCY.toLowerCase());

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
exports.attach = (line, msg) => {
  sendToSlackAttach(line, notiType.ATTACHMENT, msg);
};

let slackPost = require('slackpost');
let post = slackPost.post(WEBHOOK);
post.setUsername(CURRENCY).enableFieldMarkdown();

const EOL = require('os').EOL;

function sendToSlack(line, type=notiType.INFO, title){ 
  try {
    post
    .setColor(type.value)
    .setRichText('{0}{2}```{1}{2}```'.format(title, line, EOL), true)
    .enableUnfurlLinks()
    .send((err) => { if (err) throw err; });
    
    log(line, type, title);
  } catch(e) {
    logger.error(e);
  }
}

function sendToSlackAttach(line, type=notiType.INFO, title){ 
  try {
    post
    .setColor(type.value)
    .setRichText(line, false)
    .enableUnfurlLinks()
    .send((err) => { if (err) throw err; });
    
    log(line, type, title);
  } catch(e) {
    logger.error(e);
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
