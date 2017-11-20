exports.channel = (bot, id) => {
    let channels = bot.getChannels();
    return (channels && channels._value && channels._value.channels)
        ? '#' + channels._value.channels.find(e => e.id === id).name
        : '';
};
exports.user = (bot, id) => {
    let users = bot.getUsers();
    return (users && users._value && users._value.members)
        ? users._value.members.find(e => e.id === id).name
        : '';
};
