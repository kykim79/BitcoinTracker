const coinType = require('./coinType');
const coinTypes = coinType.enums.map((c) => c.value);

module.exports = class commandHelper {
    constructor() {
        try {
            this.commandMap = [];
        }
        catch (e) {
            throw new Error(e);
        }
    }

    addCommand(regex, func, params = []) {
        this.commandMap.push({ regex: regex, func: func, params: params });
        return this;
    }

    hasCommand(regex) {
        return this.commandMap.some((e) => e.regex === regex);
    }

    commandCount(regex) {
        return this.commandMap.filter(e => e.regex === regex).length;
    }

    execute(line) {
        return this.commandMap.filter(e => e.regex.exec(line)).map((e) => e.func(e.regex.exec(line), e.params));
    }
};
