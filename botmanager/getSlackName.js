

exports.channel = (bot, id) => channelIdToName(bot, id);
exports.user = (bot, id) => userIdToName(bot, id);

function channelIdToName(bot, id) {
    let channels = bot.getChannels();
    return (channels && channels._value && channels._value.channels)
        ? '#' + channels._value.channels.find(e => e.id === id).name
        : '';
}

function userIdToName(bot, id) {
    let users = bot.getUsers();
    return (users && users._value && users._value.members)
        ? users._value.members.find(e => e.id === id).name
        : '';
}
