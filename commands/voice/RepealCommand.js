const { Command } = require('discord.js-commando')

const LawCommandParser = require('./util/LawCommandParser')

module.exports = class RepealCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'repeal',
            group: 'voice',
            memberName: 'repeal',
            description: 'Decriminalizes a list of phrases from voice channels',
            userPermissions: ['ADMINISTRATOR'],
            throttling: {
                usages: 1,
                duration: 1
            },
            guildOnly: true
        })
    }

    run(message, unparsed) {
        const { success, reason, manager, members, phrases } = LawCommandParser.parse(message, unparsed)

        if (success) {
            let phrasesAdded = []
            for (const phrase of phrases) {
                let successExists = false
                for (const member of members) {
                    successExists = successExists || manager.removeIllegalPhrase(member, phrase)
                }

                if (successExists) {
                    phrasesAdded.push(phrase)
                    console.log(`Removed: ${phrase}`)
                } else {
                    console.log(`Remove Failed: ${phrase}`)
                }
            }

            if (phrasesAdded.length) {
                manager.save()
            }
        } else {
            console.log('PARSE_ERROR: ' + reason)
        }
    }
}