const { MessageAttachment } = require('discord.js')
const { Command } = require('discord.js-commando')

const { GuildVoiceManager } = require('../../structures')

module.exports = class ClipCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'clip',
            group: 'voice',
            memberName: 'clip',
            description: 'Returns an audio recording of the last 30 seconds',
            throttling: {
                usages: 1,
                duration: 1
            },
            guildOnly: true
        })
    }

    async run(message) {
        try {
            let manager = message.guild && GuildVoiceManager.managers.get(message.guild.id)
            if (manager) {
                manager.flushActiveAudioStreams()
                message.reply(new MessageAttachment(await manager.channelRecorder.export(), 'clip.mp3'))
            }
        } catch(e) {
            console.error(e)
        }
    }
}