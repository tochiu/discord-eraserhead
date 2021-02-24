/* time related util functions */

const { timeUnits } = require('../config.json')

// array of units sorted in descending length order first and lexiographically second
// regex match on "3mo" with /\d+(m|mo)/ will yield "3m" but yields "3mo" with /\d+(mo|m)/
let units = Object.keys(timeUnits)
units.sort((a, b) => a.length == b.length ? a.localeCompare(b) : b.length - a.length)

let unitsTimeSorted = units.slice()
unitsTimeSorted.sort((a, b) => timeUnits[b].time - timeUnits[a].time)

// regex for capturing time strings
let regex = new RegExp("\\d+(" + units.join("|") + ")", "g")

// default time tracker is all units set to zero
let template = {}
for (let unit of units) {
    template[unit] = 0
}

// time tracker is an object of form { [unit_name]: (int) number of units, ... }
function createTimeTracker() {
    return Object.assign({}, template)
}

// attempt to update the time tracker
function updateTimeTracker(tracker, str) {
    // get first regex match from str
    let unitStr = [...str.matchAll(regex)].map(data => data[0])[0]

    // exit if matched string is not the same as input string (prevents 6h2m5d => 6h being valid but 6h => 6h is)
    if (unitStr !== str) return

    // parse number and units
    let unitAmt = parseInt(str)
    let unit = str.slice(Math.max(1, Math.floor(Math.log10(unitAmt) + 1)))

    if (isNaN(unitAmt)) return
    
    tracker[unit] += unitAmt
}

function getTimeFromTracker(tracker) {
    let sum = 0
    for (let unit in tracker) {
        sum += tracker[unit]*timeUnits[unit].time
    }

    // convert to milliseconds
    return 1000*sum
}

// convert time tracker to human readable string
// long version: 4 minutes 3 seconds
// short version: 4m 3s
function getFormattedTimeFromTracker(tracker, long) {
    
    let strs = []

    for (let unit of unitsTimeSorted) {
        let amt = tracker[unit]
        if (amt === 0) continue

        strs.push(amt + (long ? " " + timeUnits[unit].name + (amt !== 1 ? "s" : "") : unit))
    }

    // insert "and" in second to last position in array if there are at least 2 units expressed
    if (long && strs.length > 1) {
        strs.splice(strs.length - 1, 0, "and")
    }

    return strs.join(" ")
}

module.exports = { createTimeTracker, updateTimeTracker, getTimeFromTracker, getFormattedTimeFromTracker }