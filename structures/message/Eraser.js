/* exports function for erasing messages from a specific channel */

const { Collection } = require("discord.js")

/* NOTE:
 * Messages newer than 2 weeks can be deleted in bulk with a maximum of 100 messages per operation
 * Messages older than 2 weeks must be deleted individually
 */

// checks if message is older than 2 weeks
function isRecent(message) {
    return Date.now() - message.createdTimestamp < 1209600000
}

// erase all messages in a given channel that occur after the given timestamp from specified users, if any
async function erase(triggerMessage, channel, timestamp, users, filterer) {

    let filterUsers = users.length !== 0

    let trash = []
    let beforeID // id of the last message fetched

    let userSet 
    let running = true

    let success = 0
    let fail = 0

    // build a set containing whitelisted user ids to compare message author ids against
    if (filterUsers) {
        userSet = new Set()
        for (user of users) {
            userSet.add(user.id)
        }
    }

    while (running) {
        // fetch as many messages sent before the id of last message fetched
        let messages = (await channel.messages.fetch({ 
            limit: 100,
            before: beforeID
        })).array()
        
        if (messages.length === 100) {
            beforeID = messages[messages.length - 1].id
        } else {
            // messages.length !== 100 => end of channel
            running = false
        }

        for (message of messages) {
            // messages are already sorted by timestamp
            if (message.createdTimestamp < timestamp) { // stop if current message is too old
                running = false
                break
            } else if (
                ( filterer && filterer(message)) ||
                (!filterer && message.id !== triggerMessage.id && (!filterUsers || userSet.has(message.author.id)))
            ) {
                // put in trash if filter function exists and message passes filter function
                //     OR
                // put in trash if message is not the command message
                //     and message was sent by a specified user, if any
                trash.push(message)
            }
        }
    }

    // exit if no messages to delete
    if (trash.length === 0) {
        return { channel, success, fail }
    }

    // get index that indicates where the first old message starts
    //     messages that need to be bulk deleted are of indicies [0, numRecents)
    //     messages that need to be deleted individually of indicies [numRecents, trash.length)
    let numRecents = trash.length
    while (numRecents > 0 && !isRecent(trash[numRecents - 1])) {
        numRecents--
    }

    let promises = []

    // push all async bulk delete requests into the array
    for (let i = 0; i < numRecents; i += 100) {
        let amt = Math.min(i + 100, numRecents) - i

        promises.push(amt > 1 
            ? channel.bulkDelete(trash.slice(i, i + amt), true)
            : trash[i].delete())
    }

    // push all async individual delete requests into the array 
    for (let i = numRecents; i < trash.length; i++) {
        promises.push(trash[i].delete())
    }

    // wait for all delete requests to finish executing in parallel
    let results = await Promise.allSettled(promises)

    for (result of results) {
        if (result.status === 'rejected') {
            // log delete error
            console.log(`erase error in #${channel.name}\n${result.reason}`)
            continue
        }

        // appropriately increment success counter
        if (result.value instanceof Collection) { // bulk delete returns a collection of messages successfully deleted
            success += result.value.size
        } else {
            success++
        }
    }

    fail = trash.length - success
    
    // log stats from channel delete requests
    let id = `<${triggerMessage.author.tag}${triggerMessage.guild ? ` in "${triggerMessage.guild.name}"` : ""} @ ${new Date().toString()}> #${channel.name}`
    let info = `${trash.length} messages found, ${success} deleted and ${fail} fails`
    
    console.log(id + ": " + info)

    return { channel, success, fail }
}

module.exports = { erase }