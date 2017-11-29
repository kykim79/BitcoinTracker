
module.exports = class commandHelper {

    constructor() {
        try {
            this.commandMap = [];
        }
        catch (e) {
            throw new Error(e);
        }
        this.invalidHandler = () => [];
    }

    addInvalidHandler(func) {
        this.invalidHandler = func;
        return this;
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
        const result = this.commandMap.filter(e => e.regex.exec(line)).map((e) => e.func(e.regex.exec(line), e.params));
        if(result.length === 0) {
            return this.invalidHandler();
        } else {
            return result;
        }
    }
};


