let replaceall = require('replaceall');

let format = require('string-format');
format.extend(String.prototype);

const CURRENCY = process.env.CURRENCY;
const currency = CURRENCY.toLowerCase();
const WEB_HOOK = process.env.WEB_HOOK;
const ICON_URL = process.env.ICON_URL + CURRENCY + '.png';
const COINS_KEY = process.env.COINS_KEY.split(',');
const COINS_CMD = process.env.COINS_CMD.split(',');

const CHART_URL = process.env.CHART_URL + COINS_KEY.indexOf(CURRENCY);
const TRACKER_NAME = process.env.TRACKER_NAME;

// LOGGER
let log4js = require('log4js');
let logger = log4js.getLogger('notifier:' + currency);

let notiType = require('./notiType.js');

exports.info = (line, title) => sendToSlack(line, title, true);
exports.warn = (line, title) => sendToSlack(line, title, true, notiType.WARN);
exports.danger = (line, title) => sendToSlack(line, title, true, notiType.DANGER);
exports.attach = (line, title) => sendToSlack(line, title, false);

let slackPost = require('slackpost');
let post = slackPost.post(WEB_HOOK);
post.setUsername(TRACKER_NAME + ' : ' + CURRENCY + ' (' +  COINS_CMD[COINS_KEY.indexOf(CURRENCY)] + ')').enableFieldMarkdown();
const EOL = require('os').EOL;

let msgLine = (line) => '```{0}```'.format(line);
let logLine = (line, title) => replaceall(EOL, '; ', title + ', ' + line);

/**
 * sendToSlack : post message and write to log
 *
 *
 * @input line : text message which cotains markdown
 * @input title : header message
 * @input markdown : always true
 * @input type : one of notiType enum
 * @return none
 */

function sendToSlack(line, title, markdown, type=notiType.INFO) {
    try {
        post
            .setColor(type.value)
            .setTitle(title,CHART_URL)
            .setRichText(markdown ? msgLine(line) : line, markdown)
            .setIconURL(ICON_URL)
            .enableUnfurlLinks()
            .send((err) => { if (err) throw err; });

        log(logLine(line, title), type);
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
