const { Command } = require('discord.js-commando')

module.exports = class PoliceCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'police',
            aliases: ['monitor', 'nsa'],
            group: 'voice',
            memberName: 'police',
            description: 'Requests the bot to join your channel',
            throttling: {
                usages: 1,
                duration: 1
            },
            guildOnly: true
        })
    }

    run(message) {
        let channel = message.member && message.member.voice.channel
        if (channel) {
            channel.join()
        }
    }
}