const { Command } = require('discord.js-commando')

module.exports = class GC extends Command {
    constructor(client) {
        super(client, {
            name: 'gc',
            group: 'voice',
            memberName: 'gc',
            description: 'gc',
            throttling: {
                usages: 1,
                duration: 1
            },
            guildOnly: true,
            ownerOnly: true
        })
    }

    async run(message) {
        try {
            global.gc()
            message.reply(`Buffer pool size: ${Buffer.poolSize}B`)
        } catch(e) {
            console.error(e)
        }
    }
}