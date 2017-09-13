var fs = require('fs');
var util = require("util");

writeToFile('./log/short.log');
writeToFile('./log/long.log');
writeToFile('./log/watch.log');
writeToFile('./log/telegram.log');

console.log('log file cleared');

function writeToFile(fname) {
  fs.writeFile(fname, '\n', (err) => {
      if (err) {
        util.error(err);
        throw err;
      }
  });
}

