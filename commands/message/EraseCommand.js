const Discord = require("discord.js")
const { Command } = require('discord.js-commando')

const { TimeTracker, Eraser } = require("../../structures")

const { all } = require("./util/config.json")
const reply = require("./util/Reply.js")

module.exports = class EraseCommand extends Command {

    constructor(client) {
        super(client, {
            name: 'erase',
            group: 'voice',
            memberName: 'erase',
            description: 'Erases messages',
            userPermissions: ['ADMINISTRATOR'],
            argsType: 'multiple',
            throttling: {
                usages: 1,
                duration: 1
            },
            guildOnly: true
        })
    }
    
    async run(message, args) {
        let taggedUsers = message.mentions.users.array()
        let taggedChannels = message.mentions.channels.array().filter(
            channel => channel.type === "text")
        
        let tracker = new TimeTracker()
        let isAll = false

        let filterUsers = taggedUsers.length !== 0
        
        // no users, no channels found
        if (!filterUsers && taggedChannels.length === 0) {
            reply.noTargets(message)
            return
        }

        // parse args for time
        for (let arg of args) {

            // skip if mention
            if (   Discord.MessageMentions.CHANNELS_PATTERN.test(arg) 
                || Discord.MessageMentions.EVERYONE_PATTERN.test(arg)
                || Discord.MessageMentions.   ROLES_PATTERN.test(arg)
                || Discord.MessageMentions.   USERS_PATTERN.test(arg)) continue
            
            // update time
            if (arg === all.keyword) {
                isAll = true
                tracker = new TimeTracker()
                tracker.parse(all.time)
                break
            } else {
                tracker.parse(arg)
            }
        }
    
        let eraseTimeSpan = tracker.getTime()
        if (eraseTimeSpan === 0) {
            reply.noTime(message)
            return
        }
    
        if (taggedChannels.length === 0) {
            taggedChannels = message.channel.guild.channels.cache.array().filter(
                channel => channel.type === "text")
    
            if (taggedChannels.length === 0) return // no channels found?!
        }
        
        let cutoffTime = Date.now() - eraseTimeSpan
    
        try {
    
            /* erase operation */
    
            let promises = []
    
            // push async erase requests to array
            for (const channel of taggedChannels) {
                promises.push(Eraser.erase(message, channel, cutoffTime, taggedUsers))
            }
            
            // wait for all erase requests to finish executing in parallel
            let results = await Promise.allSettled(promises)
            
            let anyError = false
    
            let erased = []
            let totalErased = 0
            
            for (let result of results) {
    
                if (result.status !== "fulfilled") {
                    anyError = true
                    console.log(`channel erasure error\n${result.reason}`)
                    continue
                }
    
                if (result.value.fail) { // if fail is nonzero
                    anyError = true
                }
    
                let amount = result.value.success
                if (!amount) continue // continue if success is zero
                
                // push info on channel + amount deleted onto array
                erased.push({ amount, channel: result.value.channel })
    
                // update total erased counter
                totalErased += result.value.success
            }
            
            // send message with details of erase operation
            reply.complete(message, totalErased, 
                { erased, anyError }, 
                { isAll, tracker },
                taggedUsers
            )
        } catch(e) {
            console.log("erasure command execute error")
            console.log(e)
            reply.error(message)
        }
    }
}