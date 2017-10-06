var util = require("util");
var fs = require('fs');
var replaceall = require("replaceall");

var format = require('string-format');
format.extend(String.prototype);


const FILE_NAME = './log/telegram.log';
const NEWLINE_MATCH_REGEX = '/(\r\n|\n|\r)/gm';

// LOGGER
var log4js = require('log4js');
var logger = log4js.getLogger('notifier');

let notiType = require('./notiType.js');

// module.exports = alert = (line) => {
//   sendToSlack2(line);
// };


exports.info = (line) => {
  sendToSlack2(line, notiType.INFO);
};

exports.warn = (line) => {
  sendToSlack2(line, notiType.WARN);
};

exports.danger = (line) => {
  sendToSlack2(line, notiType.DANGER);
};


let WEBHOOK_URL = 'https://hooks.slack.com/services/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' || ''; //see section above on sensitive data

const IconURL = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Bitcoin.svg/440px-Bitcoin.svg.png";
let slackPost = require('slackpost');
let post = slackPost.post(WEBHOOK_URL);

post.setUsername('BITCOIN-BOT')
    .setChannel('#bitcoin')
    .setColor(slackPost.COLOR_LIST.GOOD)
    .setIconURL(IconURL);

function sendToSlack2(line, type=notiType.INFO){
  
  try {
    post
    .setColor(type.value)
    .setRichText(`{}`.format(line), true)
    .send((err) => { if (err) throw err; });
    logger.warn(replaceall('\n', "; ",line));
  } catch (e) {
    logger.error(e);
  }
}

// myNewPost.setColor(slackPost.COLOR_LIST.GOOD);
// myNewPost.setColor(slackPost.COLOR_LIST.WARNING);
// myNewPost.setColor(slackPost.COLOR_LIST.DANGER);

// let IncomingWebhook = require('@slack/client').IncomingWebhook;
// let webhook = new IncomingWebhook(WEBHOOK_URL);

// function sendToSlack(line){
//   try {
//     let msg = {
//       text: "*bold* `code` _italic_ ~strike~",
//       username: "markdownbot",
//       mrkdwn: true
//     };
//     let str = JSON.stringify(msg);
//     webhook.send(str, function(err, header, statusCode, body) {
//       if (err) {
//         throw err;
//       }
      
//       logger.warn(replaceall('\n', "; ",line));
//     });
//   } catch(exception) {
//     logger.error(exception);
//   }
// }