
const CONFIG = process.env.CONFIG;  // configuration folder with '/'

// LOGGER
let log4js = require('log4js');
log4js.configure(CONFIG + 'loggerConfig.json');
let log4js_extend = require('log4js-extend');
log4js_extend(log4js, {
    path: __dirname,
    format: '(@name:@line:@column)'
});

exports.getLogger = (logid) => log4js.getLogger(logid);
exports.debug = (m) => log4js.debug(m);
exports.info = (m) => log4js.info(m);
exports.warn = (m) => log4js.warn(m);
exports.error = (m) => log4js.error(m);

