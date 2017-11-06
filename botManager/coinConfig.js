const coinType = require('../common/coinType.js');
const coinTypes = coinType.enums.map((c) => c.value);
const CHART_URL = process.env.CHART_URL;

module.exports = class configCoin {
    constructor(coin) {
        try {
            this.title = coin; // Big blue head
            this.title_link = CHART_URL + coinTypes.indexOf(coin); // link when title was pressed
            this.text = '';
            this.fields = [];

            // this.image_url = ICONURL + '/' + coin + '.png';
            // this.thumb_url = "http://xx.com/" + coin + ".png";
            // this.footer = "Slack API footer";
            // this.footer_icon = "https://platform.slack-edge.com/img/default_application_icon.png";
        }
        catch (exception) {
            throw new Error('Failed to make object. ' + exception);
        }
    }

    addField(titleKey, titleVal, short=true) {
        this.fields.push({ title: titleKey + titleVal, short: short });
        return this;
    }
};
