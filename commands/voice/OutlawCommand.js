const { Command } = require('discord.js-commando')
const LawCommandParser = require('./util/LawCommandParser')

module.exports = class OutlawCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'outlaw',
            group: 'voice',
            memberName: 'outlaw',
            description: 'Outlaws a list of phrases from voice channels',
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
                    successExists = successExists || manager.addIllegalPhrase(member, phrase)
                }

                if (successExists) {
                    phrasesAdded.push(phrase)
                    console.log(`Added: ${phrase}`)
                } else {
                    console.log(`Add Failed: ${phrase}`)
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