const { Command } = require('discord.js-commando')

module.exports = class UnoReverseCardCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'unoreversecard',
            group: 'voice',
            memberName: 'unoreversecard',
            description: 'Cast "Uno Reverse Card" on Radmir',
            throttling: {
                usages: 1,
                duration: 1
            },
            guildOnly: true
        })
    }

    async run(message) {
        try {
            if (message.author.id !== "434859210258513940") {
                return
            }

            let jason = message.member

            jason.voice.setDeaf(false)
            jason.voice.setMute(false)

            let radmir = message.guild.members.cache.get("261546058830577665")
            if (radmir && radmir.voice.channelID && radmir.voice.channelID === jason.voice.channelID) {
                radmir.voice.kick("Uno Reverse Card")
            }
        } catch(e) {
            console.error(e)
        }
    }
}