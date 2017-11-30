
module.exports = class commandHelper {

    constructor() {
        try {
            this.commandMap = [];
            this.invalidHandler = () => [];
        }
        catch (e) {
            throw new Error(e);
        }
    }

    addInvalidHandler(func) {
        this.invalidHandler = func;
        return this;
    }

    addCommand(regex, func, validator = () => true) {
        this.commandMap.push({ regex: regex, func: func, validator: validator });
        return this;
    }

    hasCommand(regex) {
        return this.commandMap.some((e) => e.regex === regex);
    }

    commandCount(regex) {
        return this.commandMap.filter(e => e.regex === regex).length;
    }

    execute(line) {
        const result = this.commandMap.filter(e => e.regex.exec(line)).map((e) => {
            const match = e.regex.exec(line);
            return e.validator(match) ? e.func(match) : false;
        });
        return  result.length === 0 ? this.invalidHandler() : result;
    }
};


