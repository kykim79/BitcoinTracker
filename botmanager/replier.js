
const request = require('request');
const querystring = require('querystring');
const slackPost = require('slackpost');

// environment variables
const CONFIG = process.env.CONFIG;
const WEB_TOKEN = process.env.WEB_TOKEN;
const ICON_URL = process.env.ICON_URL;

// LOGGER
let log4js = require('log4js');
log4js.configure(CONFIG + '/loggerConfig.json');
let log4js_extend = require('log4js-extend');
log4js_extend(log4js, {
    path: __dirname,
    format: '(@name:@line:@column)'
});
const logger = log4js.getLogger('replier');

const CHANNEL = process.env.CHANNEL;
const WEB_HOOK = process.env.WEB_HOOK;
const BOT_ICON = process.env.BOT_ICON;
const BOT_NAME = process.env.BOT_NAME;

exports.sendText = (text) => sendTextOnly(text);
exports.sendAttach = (iconName, text, attachs) => sendWithAttach(iconName, text, attachs);
exports.sendSlack = (line, title, url) => sendMarkDownedText(line, title, url);

function sendTextOnly(text) {
    requestMessage(buildMessage(BOT_ICON, text));
    logger.debug(text);
}

function sendWithAttach(iconName, text, attachs) {
    requestMessage(buildMessage(iconName, text, attachs));
    logger.debug(text);
}

function buildMessage(iconName, text, attachs = null) {
    const msg = {
        token: WEB_TOKEN,
        channel: CHANNEL,
        as_user: false,
        username: BOT_NAME,
        icon_url: ICON_URL + iconName + '.png',
        text: ''
    };
    if(attachs) {
        attachs[0].title += ',  ' + text;
        msg.attachments = JSON.stringify(attachs);
    }
    else {
        msg.text = text;
    }
    return msg;
}

function sendMarkDownedText(line, title, url) {
    try {

        let post = slackPost.post(WEB_HOOK);
        post
            .setUsername(BOT_NAME)
            .enableFieldMarkdown()
            .setColor('#6bbf8e')
            .setTitle(title, url)
            .setRichText(line,true)
            .setIconURL(ICON_URL + BOT_ICON + '.png')
            .enableUnfurlLinks()
            .send((err) => { if (err) throw err; });
        logger.debug(title);
    } catch(e) {
        logger.error(e);
    }
}

function requestMessage(msg) {
    let webMsg = 'http://slack.com/api/chat.postMessage?' + querystring.stringify(msg);
    request(webMsg, function(error, response) {
        if (error || response.statusCode !== 200) {
            logger.error(error);
        }
    });
}


