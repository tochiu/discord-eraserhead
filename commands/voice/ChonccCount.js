const { Command } = require('discord.js-commando')

const { GuildVoiceManager } = require('../../structures')

module.exports = class ChonccCount extends Command {
    constructor(client) {
        super(client, {
            name: 'choncc',
            group: 'voice',
            memberName: 'choncccount',
            description: 'Returns how many times arsalan has said choncc',
            throttling: {
                usages: 1,
                duration: 1
            },
            guildOnly: true
        })
    }

    async run(message) {
        try {
            let manager = GuildVoiceManager.managers.get(message.guild.id)
            if (manager) {
                message.reply(`Arsalan has said "choncc" **${manager.arsalanChonccCounter.getCount()}** times in **${manager.guild.name}**`)
            }
        } catch(e) {
            console.error(e)
        }
    }
}