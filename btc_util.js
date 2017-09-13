var pad = require('pad');
var moment = require('moment');
var mt = require('moment-timezone');
var numeral = require('numeral');
var fs = require('fs');

exports.multiPopQueue = (queue, size) => queue.splice(0, size); // queue의 앞(0번째)부터 size만큼 제거

exports.fileToQueue = (fname, queue) => {
  if(!fs.existsSync(fname)) {
    return;
  }
  JSON.parse(fs.readFileSync(fname)).forEach( _ => queue.push(_));
};
//exports.fileToQueue = (fname, queue) => JSON.parse(fs.readFileSync(fname)).forEach( e => queue.push(e) );

exports.numeralPad = (number) => pad(10, numeral((number)).format('0,0'));

exports.datetimeString = (date) => {
  if((date) == null) {
    (date) = new Date();
  }
  return moment((date)).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');
};

exports.dateString = (date) => {
  if((date) == null) {
    (date) = new Date();
  }
  return moment((date)).tz('Asia/Seoul').format('MM-DD HH:mm');
};



