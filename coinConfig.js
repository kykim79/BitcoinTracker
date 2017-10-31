module.exports = class configCoin {
    constructor(coin) {
        try {
            this.title = coin; // Big blue head
            this.title_link = "http:/riopapa.zzux.com:4000"; // link when title was pressed
            this.text = "";
            this.fields = [];
            // this.image_url = "http://riopapa.zzux.com/" + coin + ".png";
            // this.thumb_url = "http://riopapa.zzux.com/" + coin + ".png";
            // this.footer = "Slack API footer";
            // this.footer_icon = "https://platform.slack-edge.com/img/default_application_icon.png";
        }
        catch (exception) {
            throw new Error('Failed to make object. ' + exception);
        }
    }
    
    addField(titleKey, titleVal, short=true) {
        this.fields.push({ title: titleKey + titleVal, short: true })
        return this;
    }
}
