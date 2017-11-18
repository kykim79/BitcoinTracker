
const request = require('request');
const querystring = require('querystring');
const slackPost = require('slackpost');

// environment variables
const WEB_TOKEN = process.env.WEB_TOKEN;
const ICON_URL = process.env.ICON_URL;
const CHANNEL = process.env.CHANNEL;
const WEB_HOOK = process.env.WEB_HOOK;
const BOT_ICON = process.env.BOT_ICON;
const BOT_NAME = process.env.BOT_NAME;
const logger = require('./logger.js').getLogger('replier');

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
        attachs[0].title += ',  _' + text + '_';
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
            .setColor(slackPost.COLOR_LIST['GOOD'])
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


