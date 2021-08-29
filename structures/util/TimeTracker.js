/* time related util functions */

const TIME_UNITS = {
    s : { name: "second", time: 1        },
    m : { name: "minute", time: 60       }, 
    h : { name: "hour",   time: 3600     }, 
    d : { name: "day",    time: 86400    },
    w : { name: "week",   time: 604800   },
    mo: { name: "month",  time: 2629743  },
    y : { name: "year",   time: 31556926 }
}

// array of units sorted in descending length order first and lexiographically second
// regex match on "3mo" with /\d+(m|mo)/ will yield "3m" but yields "3mo" with /\d+(mo|m)/
let units = Object.keys(TIME_UNITS)
units.sort((a, b) => a.length == b.length ? a.localeCompare(b) : b.length - a.length)

let unitsTimeSorted = units.slice()
unitsTimeSorted.sort((a, b) => TIME_UNITS[b].time - TIME_UNITS[a].time)

// regex for capturing time strings
let regex = new RegExp("\\d+(" + units.join("|") + ")", "g")

class TimeTracker {

    constructor() {
        this.units = {}
        for (const unit of units) {
            this.units[unit] = 0
        }
    }

    parse(str) {
        let unitStr = [...str.matchAll(regex)].map(data => data[0])[0]

        // exit if matched string is not the same as input string (prevents 6h2m5d => 6h being valid but 6h => 6h is)
        if (unitStr !== str) return

        // parse number and units
        let unitAmt = parseInt(str)
        let unit = str.slice(Math.max(1, Math.floor(Math.log10(unitAmt) + 1)))

        if (isNaN(unitAmt)) return
        
        this.units[unit] += unitAmt
    }

    getTime() {
        let sum = 0
        for (let unit in this.units) {
            sum += this.units[unit]*TIME_UNITS[unit].time
        }
        // convert to milliseconds
        return 1000*sum
    }

    getFormattedTime(long) {

        let strs = []
    
        for (let unit of unitsTimeSorted) {
            let amt = this.units[unit]
            if (amt === 0) continue
    
            strs.push(amt + (long ? " " + TIME_UNITS[unit].name + (amt !== 1 ? "s" : "") : unit))
        }
    
        // insert "and" in second to last position in array if there are at least 2 units expressed
        if (long && strs.length > 1) {
            strs.splice(strs.length - 1, 0, "and")
        }
    
        return strs.join(" ")
    }
}

module.exports = TimeTracker