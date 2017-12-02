
const request = require('request');
const replaceall = require('replaceall');
const querystring = require('querystring');
const CURRENCY = process.env.CURRENCY;
const currency = CURRENCY.toLowerCase();

// environment variables
const WEB_TOKEN = process.env.WEB_TOKEN;
const ICON_URL = process.env.ICON_URL;
const CHANNEL = process.env.CHANNEL;
// const WEB_HOOK = process.env.WEB_HOOK;
// const BOT_ICON = process.env.BOT_ICON;
const BOT_NAME = process.env.BOT_NAME;

let log4js = require('log4js');
const logger = log4js.getLogger('replier:' + currency);

// exports.sendText = (text) => sendTextOnly(text);
exports.sendAttach = (iconName, text, attachs) => sendWithAttach(iconName, text, attachs);
// exports.sendSlack = (line, title, url) => sendMarkDownedText(line, title, url);

// function sendTextOnly(text) {
//     requestMessage(buildMessage(BOT_ICON, text));
//     logger.debug(text);
// }

function sendWithAttach(iconName, text, attachs) {
    requestMessage(buildMessage(iconName, text, attachs));
    logger.debug(replaceall('\n', '; ', text));
}

function buildMessage(iconName, text, attachs = null) {
    const msg = {
        token: WEB_TOKEN,
        channel: CHANNEL,
        as_user: false,
        username: BOT_NAME + iconName,
        icon_url: ICON_URL + iconName + '.png',
        text: ''
    };
    if(attachs) {
        attachs[0].title += text;
        msg.attachments = JSON.stringify(attachs);
    }
    else {
        msg.text = text;
    }
    return msg;
}

function requestMessage(msg) {
    let webMsg = 'http://slack.com/api/chat.postMessage?' + querystring.stringify(msg);
    request(webMsg, function(error, response) {
        if (error || response.statusCode !== 200) {
            logger.error(error);
        }
    });
}


