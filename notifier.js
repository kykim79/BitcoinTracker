var replaceall = require('replaceall');

var format = require('string-format');
format.extend(String.prototype);

const CURRENCY = process.env.CURRENCY;
const WEBHOOK = process.env.WEBHOOK;

// LOGGER
var log4js = require('log4js');
var logger = log4js.getLogger('notifier:' + CURRENCY.toLowerCase());

let notiType = require('./notiType.js');

exports.info = (line, title) => sendToSlack(line, title, true);
exports.warn = (line, title) => sendToSlack(line, title, true, notiType.WARN);
exports.danger = (line, title) => sendToSlack(line, title, true, notiType.WARN);
exports.attach = (line, title) => sendToSlack(line, title, false);

let slackPost = require('slackpost');
let post = slackPost.post(WEBHOOK);
post.setUsername(CURRENCY).enableFieldMarkdown();
const EOL = require('os').EOL;

//var mdLine = (line, title) => '{0}{2}```{1}{2}```'.format(title, line, EOL);
var singleLine = (line, title) => replaceall(EOL, '; ', title + ', ' + line);

function sendToSlack(line, title, markdown, type=notiType.INFO){
  try {
    //post
    // .setColor(type.value)
    // .setRichText(markdown ? mdLine(line, title) : line, markdown)
    // .enableUnfurlLinks()
    // .send((err) => { if (err) throw err; });

    log(singleLine(line, title), type);
  } catch(e) {
    logger.error(e);
  }
}

function log(m, type) {
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
