let replaceall = require('replaceall');

let format = require('string-format');
format.extend(String.prototype);

const CURRENCY = process.env.CURRENCY;
const currency = CURRENCY.toLowerCase();
const WEBHOOK = process.env.WEBHOOK;
const ICON_URL = process.env.ICON_URL + CURRENCY + '.png';
const coinType = require('./coinType.js');
const coinTypes = coinType.enums.map((c) => c.value);
const CHART_URL = process.env.CHART_URL + coinTypes.indexOf(CURRENCY);

// LOGGER
let log4js = require('log4js');
let logger = log4js.getLogger('notifier:' + currency);

let notiType = require('./notiType.js');

exports.info = (line, title) => sendToSlack(line, title, true);
exports.warn = (line, title) => sendToSlack(line, title, true, notiType.WARN);
exports.danger = (line, title) => sendToSlack(line, title, true, notiType.DANGER);
exports.attach = (line, title) => sendToSlack(line, title, false);

let slackPost = require('slackpost');
let post = slackPost.post(WEBHOOK);
post.setUsername(CURRENCY).enableFieldMarkdown();
const EOL = require('os').EOL;

let msgLine = (line) => '```{0}```'.format(line);
let logLine = (line, title) => replaceall(EOL, '; ', title + ', ' + line);

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
