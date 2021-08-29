const fs = require('fs')
const EventEmitter = require('events')
const PhraseSet = require('./PhraseSet')

const ARSALAN_DIR = 'data/illegal_phrases/'

class ArsalanChonccCounter {
    
    static arsalanID = '497176839903641611'
    static chonccPhraseSet = new PhraseSet(['chunk', 'choc', 'cha', 'choncc', 'chong', 'cham'])

    constructor(guildId) {
        this.chonccTimestamps = []
        this.loaded = false
        this.guildId = guildId

        fs.readFile(ARSALAN_DIR + guildId + '_arsalan.json', async (err, rawData) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    rawData = '{"choncc":[]}'
                } else {
                    console.error(err)
                    return
                }
            }

            for (const timestamp of JSON.parse(rawData).choncc) {
                this.chonccTimestamps.push(timestamp)
            }

            this.loaded = true
        })
    }

    getCount() {
        return this.chonccTimestamps.length
    }

    registerChoncc() {
        console.log('choncc')
        this.chonccTimestamps.push(Date.now())
        this.save()
        return this.chonccTimestamps.length % 5 === 0
    }

    async save() {
        if (!this.loaded) {
            return false
        }

        let saveData = {
            choncc: this.chonccTimestamps
        }
        
        try {
            fs.writeFileSync(ARSALAN_DIR + guildId + '_arsalan.json', JSON.stringify(saveData, null, '\t')) // pretty print JSON
        } catch(err) {
            console.error(err)
            return false
        }
        
        return true
    }
}

module.exports = ArsalanChonccCounter