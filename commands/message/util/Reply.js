/* util functions related to sending reply messages */

const { visual, all } = require("./config.json")
const { TimeTracker } = require("../../../structures")

let exampleCommandDurationStr

// reply stating that an error occured
async function error(message) {
    try {
        await message.reply("It seems a villain has made an error occur.")
    } catch(e) {
        console.log("error reply failed")
        console.log(e)
    }
}

// reply stating that there arent any targets to start a search
async function noTargets(message) {
    try {
        await message.reply("My quirk requires you to mention **at least one** text channel **or** user to activate.")
    } catch(e) {
        console.log("missing targets reply failed")
        console.log(e)
    }
}

// reply stating there isnt any time duration specified
async function noTime(message) {
    let msg = "My quirk cannot activate without specifying a **non-zero integer** duration to erase messages within."
    try {
        await message.reply(`${msg}\n\n${exampleCommandDurationStr}`)
    } catch(e) {
        console.log("missing time reply failed")
        console.log(e)
    }
}

// reply with a rich embed detailing how the erase operation went
async function complete(message, total, breakdown, timeInfo, taggedUsers) {
    let success = total > 0
    let embed = { /* rich embed object */
        thumbnail: {
            url: success ? visual.success.imageURL : visual.failure.imageURL
        },
        author: {
            name: message.author.tag,
            icon_url: message.author.displayAvatarURL({ dynamic: true })
        }
    }

    if (success) {
        let emoji = visual.success.emoji
        let timeStr = timeInfo.isAll ? all.description : timeInfo.tracker.getFormattedTime(true).toUpperCase()
        let userStr = taggedUsers.length !== 0 ? taggedUsers.map(user => user.tag).join(" ") : "all users"

        embed.color = visual.success.color
        embed.description = `${emoji} Erased **${total}** message${total > 1 ? "s" : ""} sent within \`\`\`${timeStr}\`\`\` from **${userStr}** in the following channels:`
        embed.fields = [
            {
                name: "Channel",
                inline: true,
                value: breakdown.erased.map(info => `\`${info.channel.name}\``).join("\n")
            },
            {
                name: "Deleted",
                inline: true,
                value: breakdown.erased.map(info => info.amount).join("\n")
            }
        ]
    } else {
        let emoji = visual.failure.emoji
        let reasons = breakdown.anyError ? "**At least one error occured.**" : ""

        embed.color = visual.failure.color
        embed.description = `${emoji} No messages I could erase matched the given search criteria. ${reasons}`
    }

    try {
        await message.channel.send({ embed })
    } catch(e) {
        console.log("erase complete reply failed")
        console.log(e)
    }
}

module.exports = { noTargets, noTime, complete, error }

// Setup exampleCommandDurationStr

let exampleTimeTrackerA = new TimeTracker()
let exampleTimeTrackerB = new TimeTracker()

for (unit in exampleTimeTrackerA) {
    exampleTimeTrackerA[unit] = 4
}

exampleTimeTrackerB[Object.keys(exampleTimeTrackerB)[1]] = 4

exampleCommandDurationStr = ([
    "**Examples:**",
    `$erase #example-channel @example-user **${exampleTimeTrackerA.getFormattedTime()}**`,
    `$erase #example-channel @example-user **${exampleTimeTrackerB.getFormattedTime()}**`,
    `$erase #example-channel @example-user **${all.keyword}**`
]).join("\n")