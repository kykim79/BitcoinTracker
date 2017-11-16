const coinType = require('./coinType.js');
const coinTypes = coinType.enums.map((c) => c.value);
const CHART_URL = process.env.CHART_URL;
const findKey = (value) => coinType.enums.find((e) => e.value === value).key;

module.exports = class configCoin {
    constructor(coin = 'BTC') {
        try {
            this.title = coin + ' (' + findKey(coin) + ')'; // Big blue head
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

    addField(titleKey, titleKey2, value = '') {
        this.fields.push({ title: titleKey + titleKey2, value: value, short: true});
        // this.fields.push({ title: titleKey + titleKey2, value: value, short: true, mrkdwn_in: ['title','text'] });
        return this;
    }
    addFieldFull(title, value, short=false) {
        this.fields.push({ title: title, value: value, short: short });
        return this;
    }
};
