'use strict';

let Enum = require('enum');

const notiType = new Enum({'INFO' : '#6bbf8e', 'WARN' : '#F3FF35', 'DANGER' : '#DC143C', 'ATTCHMENT' : '#DC143C'});

module.exports = Object.freeze(notiType);