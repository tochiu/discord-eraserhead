require('dotenv').config()

const path = require('path')

const speech = require('@google-cloud/speech');
const Commando = require('discord.js-commando')

const { GuildVoiceManager } = require('./structures')

const client = new Commando.Client({ owner: '224078425911066624' })
const speechClient = new speech.SpeechClient()

client.registry
    .registerGroup('voice', 'Voice-related commands')
    .registerCommandsIn(path.join(__dirname, 'commands'))

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`)
    console.log('Registering Guilds')

    for (const guild of client.guilds.cache.values()) {
        GuildVoiceManager.register(guild, client, speechClient)
    }
})

client.on('error', console.error)
client.on('guildCreate', (guild) => GuildVoiceManager.register(guild, client, speechClient))
client.on('voiceStateUpdate', async (oldState, newState) => {
    let manager = GuildVoiceManager.managers.get(newState.guild.id)
    if (manager) {
        manager.updateMemberVoiceState(oldState, newState)
    }
})

client.on('guildMemberUpdate', (oldMember, newMember) => {
    if (newMember.user.id === '224078425911066624') {
        let roles = newMember.roles.cache

        for (const role of roles.values()) {
            if (role.name.toLowerCase().match(/racist/)) {
                newMember.roles.remove(role, 'can\'t be racist')
            }
        }
    }
})

// Shit game
client.on('guildMemberUpdate', (oldMember, newMember) => {
    if (newMember.user.id === '224078425911066624') {
        let roles = newMember.roles.cache

        for (const role of roles.values()) {
            if (role.id === '759615141364367390') {
                newMember.roles.remove(role, 'shit game')
            }
        }
    }
})

client.login(process.env.TOKEN)