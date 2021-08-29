const Discord = require('discord.js')
const { GuildVoiceManager } = require('../../../structures')

const USERS_PATTERN = Discord.MessageMentions.USERS_PATTERN

class LawCommandParseResult {
    constructor(arg1, arg2, arg3) {
        if (arg1 instanceof GuildVoiceManager) {
            this.success = true
            this.manager = arg1
            this.members = arg2
            this.phrases = arg3
        } else {
            this.success = false
            this.reason = arg1
        }
    }
}

class LawCommandParser {

    static PARSE_ERROR = {
        VOICE_MANAGER_ABSENT: 0,
        VOICE_MANAGER_LOADING: 1,
        OTHER_MENTIONS_EXIST: 2,
        CANNOT_MANAGE_MEMBERS: 3,
        BAD_REQUEST_ORDER: 4,
        NO_TARGETS: 5,
        NO_PHRASES: 6
    }

    static parse(message, unparsed) {
        let members = []
        let guildVoiceManager = message.guild && GuildVoiceManager.managers.get(message.guild.id)

        if (!guildVoiceManager) {
            return new LawCommandParseResult(LawCommandParser.PARSE_ERROR.VOICE_MANAGER_ABSENT)
        } else if (!guildVoiceManager.loaded) {
            return new LawCommandParseResult(LawCommandParser.PARSE_ERROR.VOICE_MANAGER_LOADING)
        }

        if (
            message.mentions.channels.size || 
            message.mentions.crosspostedChannels.size || 
            message.mentions.everyone || 
            message.mentions.roles.size
        ) {
            return new LawCommandParseResult(LawCommandParser.PARSE_ERROR.OTHER_MENTIONS_EXIST)
        }

        if (unparsed.startsWith(GuildVoiceManager.GLOBAL_ID)) {
            unparsed = unparsed.slice(GuildVoiceManager.GLOBAL_ID.length).trim()
            members.push(GuildVoiceManager.GLOBAL_ID)
        }

        if (message.mentions.members && message.mentions.members.size) {
            let mentionMembers = new Discord.Collection()

            for (const member of message.mentions.members.values()) {
                if (GuildVoiceManager.shouldManageMember(member)) {
                    mentionMembers.set(`<@!${member.id}>`, member)
                } else {
                    return new LawCommandParseResult(LawCommandParser.PARSE_ERROR.CANNOT_MANAGE_MEMBERS)
                }
            }

            let mentions = unparsed.match(USERS_PATTERN)
            if (mentions && mentionMembers.size) {
                for (const mention of mentions) {
                    if (unparsed.startsWith(mention)) {
                        unparsed = unparsed.slice(mention.length).trim()

                        let member = mentionMembers.get(mention)
                        if (member) {
                            mentionMembers.delete(mention)
                            members.push(member)
                        }
                    }
                }

                if (mentionMembers.size) {
                    return new LawCommandParseResult(LawCommandParser.PARSE_ERROR.BAD_REQUEST_ORDER)
                }
            }
        }

        if (!members.length) {
            return new LawCommandParseResult(LawCommandParser.PARSE_ERROR.NO_TARGETS)
        }

        let phrases = unparsed
            .split(',')
            .map(phrase => phrase.trim())
            .filter(phrase => phrase)
        
        if (!phrases.length) {
            return new LawCommandParseResult(LawCommandParser.PARSE_ERROR.NO_PHRASES)
        }

        return new LawCommandParseResult(guildVoiceManager, members, phrases)
    }
}

module.exports = LawCommandParser