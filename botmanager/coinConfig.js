
const CHART_URL = process.env.CHART_URL;
const COINS_KEY = process.env.COINS_KEY.split(',');
const COINS_CMD = process.env.COINS_CMD.split(',');

module.exports = class coinConfig {
    constructor(coin = 'BTC') {
        try {
            this.title =  coin + '(' + COINS_CMD[COINS_KEY.indexOf(coin)] + ')'; // Big blue head
            this.title_link = CHART_URL + COINS_KEY.indexOf(coin); // link when title was pressed
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
        return this;
    }
    // addFieldFull(title, value, short=false) {
    //     this.fields.push({ title: title, value: value, short: short });
    //     return this;
    // }
};
