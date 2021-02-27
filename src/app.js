const env = require("dotenv")
const config = require("../config.json")

const Discord = require("discord.js")

const time = require("./time.js")
const reply = require("./reply.js")

const erase = require("./erase.js")

const { prefix, command, cleanCommand, permission, all } = config
const { createTimeTracker, updateTimeTracker, getTimeFromTracker } = time

function isCommand(message) {
    if (   ! message.content.startsWith(prefix)
        ||   message.author.bot
        || ! message.member
        || ! message.member.hasPermission(permission)
        || !(message.channel instanceof Discord.TextChannel)) {
            return {
                args: [], 
                isValidCommand: false, 
                isCleanCommand: false
            }
        }
    
    // cut prefix and split message into array of strings delimited by spaces
    let args = message.content.toLowerCase().slice(prefix.length).trim().split(/ +/)
    let msgCommand = args.shift() // get and remove the first string (command) from array

    return {
        args,
        isValidCommand: msgCommand === command || msgCommand === cleanCommand, 
        isCleanCommand: msgCommand === cleanCommand, 
    }
}

// setup environment vars
env.config()

/* invite link:
 * https://discord.com/oauth2/authorize?client_id=812873002462478357&scope=bot&permissions=75776
 */

const client = new Discord.Client()

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`)
})

client.on("message", async (message) => {

    let { isValidCommand, isCleanCommand, args } = isCommand(message)
    if (!isValidCommand) return

    let taggedUsers = message.mentions.users.array()
    let taggedChannels = message.mentions.channels.array().filter(
        channel => channel.type === "text")
    
    let tracker = createTimeTracker()
    let isAll = false

    if (isCleanCommand) {
        taggedUsers = []
        isAll = true
        updateTimeTracker(tracker, all.time)
    } else {
        let filterUsers = taggedUsers.length !== 0
        
        // no users, no channels found
        if (!filterUsers && taggedChannels.length === 0) {
            reply.noTargets(message)
            return
        }

        // run through args to calculate delete time
        for (let arg of args) {
            // if arg can be resolved as a mention then continue
            if (   Discord.MessageMentions.CHANNELS_PATTERN.test(arg) 
                || Discord.MessageMentions.EVERYONE_PATTERN.test(arg)
                || Discord.MessageMentions.   ROLES_PATTERN.test(arg)
                || Discord.MessageMentions.   USERS_PATTERN.test(arg)) continue
            

            if (arg === all.keyword) { // if arg is the keyword to delete all then update as so
                isAll = true
                tracker = createTimeTracker()
                updateTimeTracker(tracker, all.time)
                break
            } else { // attempt to parse arg for time normally
                updateTimeTracker(tracker, arg)
            }
        }
    }

    let eraseTimeSpan = getTimeFromTracker(tracker)
    if (eraseTimeSpan === 0) { // happens either cause no arg could be parsed as valid time or the time is not non-zero
        reply.noTime(message)
        return
    }

    if (taggedChannels.length === 0) {
        // get all channels in guild if channels arent specified
        taggedChannels = message.channel.guild.channels.cache.array().filter(
            channel => channel.type === "text")

        if (taggedChannels.length === 0) return // no channels found?!
    }

    let cutoffTime = Date.now() - eraseTimeSpan

    /* erase command logic */

    try {

        /* erase operation */

        let promises = []

        // push async erase requests to array
        if (isCleanCommand) {
            for (channel of taggedChannels) {
                promises.push(erase(message, channel, cutoffTime, taggedUsers, 
                    (msg) => isCommand(msg).isValidCommand || msg.author.id === client.user.id))
                    // delete if can be parsed as a valid command or is a message from the bot itself
            }
        } else {
            for (channel of taggedChannels) {
                promises.push(erase(message, channel, cutoffTime, taggedUsers))
            }
        }
        
        // wait for all erase requests to finish executing in parallel
        let results = await Promise.allSettled(promises)
        
        let anyError = false

        let erased = []
        let totalErased = 0
        
        for (let result of results) {

            if (result.status !== "fulfilled") {
                // log error and continue
                anyError = true
                console.log(`channel erasure error\n${result.reason}`)
                continue
            }

            if (result.value.fail) { // if fail is nonzero
                anyError = true
            }

            let amount = result.value.success
            if (!amount) continue // continue of success is zero
            
            // push info on channel + amount deleted onto array
            erased.push({ amount, channel: result.value.channel })

            // update total erased counter
            totalErased += result.value.success
        }

        if (!isCleanCommand) {
            // send message with details of erase operation
            reply.complete(message, totalErased, 
                { erased, anyError }, 
                { isAll, tracker },
                taggedUsers
            )
        }

    } catch(e) { // error occured executing command

        console.log("erasure command execute error")
        console.log(e)

        // notify requester
        reply.error(message)
    }
})

client.login(process.env.TOKEN)