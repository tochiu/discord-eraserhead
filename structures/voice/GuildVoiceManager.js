const fs = require('fs')
const EventEmitter = require('events')
const Lame = require('node-lame').Lame

const SpeechTranscriber = require('./SpeechTranscriber');
const PhraseSet = require('./PhraseSet');
const ArsalanChonccCounter = require('./ArsalanChonccCounter');

const PATH_PHRASE_SETS_ILLEGAL = 'data/illegal_phrases/'
const GLOBAL_ID = 'all'

const BUFFER_AUDIO_CLIP_SIZE = SpeechTranscriber.BUFFER_AUDIO_CLIP_SIZE

const MEMBER_VOICE_CHANNEL_STATE = {
    JOINING: 0,
    LEAVING: 1,
    CHANGING: 2
}

class GuildVoiceManager {
    
    static GLOBAL_ID = GLOBAL_ID
    static managers = new Map()

    static async register(guild, client, speechClient) {
        if (GuildVoiceManager.managers.has(guild.id)) {
            return
        }
        console.log(`Registering Guild "${guild.name}" <${guild.id}>`)
        GuildVoiceManager.managers.set(guild.id, new GuildVoiceManager(guild, client, speechClient))
    }

    static shouldManageMember(member) {
        return !member.user.bot && member.id !== '231410548216954880'
    }

    constructor(guild, client, speechClient) {
        this.guild = guild
        this.guildID = guild.id
        this.clientID = client.user.id
        
        this.speechClient = speechClient

        this.channelRecorder = new ChannelRecorder()
        this.arsalanChonccCounter = new ArsalanChonccCounter(this.guildID)
        
        this._currentMonitors = new Map()
        this._currentChannelID = undefined
        this._currentChannelConnection = null
        
        this._globalIllegalPhraseSet = new PhraseSet()
        this._memberIllegalPhraseSets = new Map()
        
        this.loaded = false

        

        fs.readFile(PATH_PHRASE_SETS_ILLEGAL + this.guildID + ".json", async (err, rawData) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    rawData = '{}'
                } else {
                    console.error(err)
                    return
                }
            }

            for (const [memberID, illegalPhrases] of Object.entries(JSON.parse(rawData))) {
                if (memberID === GLOBAL_ID) {
                    for (const phrase of illegalPhrases) {
                        this._globalIllegalPhraseSet.addPhrase(phrase)
                    }
                } else {
                    let phraseSet = this._memberIllegalPhraseSets.get(memberID)
                    if (phraseSet) {
                        for (phrase of illegalPhrases) {
                            phraseSet.addPhrase(phrase)
                        }
                    } else {
                        this._memberIllegalPhraseSets.set(memberID, new PhraseSet(illegalPhrases))
                    }
                }
            }

            this.loaded = true
            if (guild.voice && guild.voice.channel && !this._currentChannelID) {
                let channel = guild.voice.channel
                await guild.voice.kick()
                channel.join()
            }
        })
    }

    async save() {
        if (!this.loaded) {
            return false
        }

        let saveData = {}
        let savePath = PATH_PHRASE_SETS_ILLEGAL + this.guildID + ".json"
        
        let globalIllegalPhraseSet = this._globalIllegalPhraseSet
        let memberIllegalPhraseSets = this._memberIllegalPhraseSets

        if (memberIllegalPhraseSets.size === 0 && globalIllegalPhraseSet.phrases.length === 0) {
            fs.unlink(savePath, (err) => {
                if (err && err.code !== 'ENOENT') {
                    console.error(err)
                }
            })
            return true
        }

        if (globalIllegalPhraseSet.phrases.length !== 0) {
            saveData[GLOBAL_ID] = globalIllegalPhraseSet.phrases
        }

        memberIllegalPhraseSets.forEach((phraseSet, memberID) => {
            saveData[memberID] = phraseSet.phrases
        })
        
        try {
            fs.writeFileSync(savePath, JSON.stringify(saveData, null, '\t')) // pretty print JSON
        } catch(err) {
            console.error(err)
            return false
        }
        
        return true
    }
    
    addIllegalPhrase(member, phrase) {
        if (member === GLOBAL_ID) {
            return this._globalIllegalPhraseSet.addPhrase(phrase)
        } else {
            let memberID = member.user.id
            let phraseSet = this._memberIllegalPhraseSets.get(memberID)

            if (!phraseSet) {
                phraseSet = new PhraseSet()
                this._memberIllegalPhraseSets.set(memberID, phraseSet)

                let monitor = this._currentMonitors.get(memberID)
                if (monitor) {
                    monitor.addPhraseSet(phraseSet)
                }
            }

            return phraseSet.addPhrase(phrase)
        }
    }

    removeIllegalPhrase(member, phrase) {
        if (member ===  GLOBAL_ID) {
            return this._globalIllegalPhraseSet.removePhrase(phrase)
        } else {
            let memberID = member.user.id
            let phraseSet = this._memberIllegalPhraseSets.get(memberID)

            if (phraseSet) {
                let success = phraseSet.removePhrase(phrase)
                if (success && phraseSet.phrases.length === 0) {
                    this._memberIllegalPhraseSets.delete(memberID)
                    let monitor = this._currentMonitors.get(memberID)
                    if (monitor) {
                        monitor.removePhraseSet(phraseSet)
                    }
                }

                return success
            }
        }
    }

    flushActiveAudioStreams() {
        this._currentMonitors.forEach(monitor => monitor.transcriber.flush())
    }

    manageMember(member) {
        let memberID = member.id

        if (this._currentMonitors.has(memberID)) {
            let monitor = this._currentMonitors.get(memberID)
            this._currentMonitors.delete(memberID)
            monitor.destroy()
        }
        
        let monitor = new VoiceMonitor(member, this.speechClient,
            this._currentChannelConnection.receiver.createStream(member.user, { mode: 'pcm', end: 'manual'}))
        let memberPhraseSet = this._memberIllegalPhraseSets.get(memberID)
        if (memberPhraseSet) {
            monitor.addPhraseSet(memberPhraseSet)
        }
        
        monitor.addPhraseSet(this._globalIllegalPhraseSet)

        monitor.on('match', (phraseSet) => {
            if (phraseSet === this._globalIllegalPhraseSet || phraseSet === memberPhraseSet) {
                member.voice.kick()
            }
        })

        if (memberID === ArsalanChonccCounter.arsalanID) {
            console.log('arsalan detected')
            monitor.addPhraseSet(ArsalanChonccCounter.chonccPhraseSet)
            monitor.on('match', (phraseSet) => {
                if (phraseSet === ArsalanChonccCounter.chonccPhraseSet) {
                    if (this.arsalanChonccCounter.registerChoncc()) {
                        member.voice.kick('said choncc too many times')
                    } 
                }
            })
        }

        this._currentMonitors.set(memberID, monitor)
        this.channelRecorder.registerVoiceMonitor(monitor)
    }

    updateVoiceStateLeave() {
        this._currentChannelID = undefined
        this._currentChannelConnection = null

        this.channelRecorder.clear()
        
        this._currentMonitors.forEach(monitor => monitor.destroy())
        this._currentMonitors.clear()
    }

    updateVoiceStateJoin(voiceState) {
        this._currentChannelID = voiceState.channelID
        this._currentChannelConnection = voiceState.connection
        
        for (const member of voiceState.channel.members.filter(GuildVoiceManager.shouldManageMember).values()) {
            this.manageMember(member)
        }
    }

    updateMemberVoiceState(oldState, newState) {
        if (!oldState) {
            oldState = {
                channelID: undefined
            }
        }
        if (newState.channelID === oldState.channelID) {
            return
        }
        
        let channelState = 
            (!oldState.channelID ? MEMBER_VOICE_CHANNEL_STATE.JOINING :
                (!newState.channelID ? MEMBER_VOICE_CHANNEL_STATE.LEAVING :
                    MEMBER_VOICE_CHANNEL_STATE.CHANGING)) 
        
        let isJoinAction = 
            channelState === MEMBER_VOICE_CHANNEL_STATE.JOINING || 
            channelState === MEMBER_VOICE_CHANNEL_STATE.CHANGING
        
        let isLeaveAction = 
            channelState === MEMBER_VOICE_CHANNEL_STATE.LEAVING || 
            channelState === MEMBER_VOICE_CHANNEL_STATE.CHANGING
        
        let member = newState.member
        let memberID = member.id
        
        if (newState.member.user.id === this.clientID) {
            if (isLeaveAction) {
                this.updateVoiceStateLeave()
            }
            if (isJoinAction) {
                this.updateVoiceStateJoin(newState)
            }
        } else if (isJoinAction && newState.channelID === this._currentChannelID && GuildVoiceManager.shouldManageMember(newState.member)) {
            this.manageMember(newState.member)
        } else if (isLeaveAction && oldState.channelID === this._currentChannelID && this._currentMonitors.has(memberID)) {
            let monitor = this._currentMonitors.get(memberID)
            this._currentMonitors.delete(memberID)
            monitor.destroy()
        }
    }
}

class ChannelRecorder {
    constructor() {
        this._recorderList = []
        this._removeRecorder = this._removeRecorder.bind(this)
    }

    clear() {
        this._recorderList = []
    }

    async export() {
        
        let mixSourceBuffers = this._recorderList.map(recorder => recorder.getBuffer())

        let mixBuffer = Buffer.alloc(BUFFER_AUDIO_CLIP_SIZE, 0)
        let mixSourceCount = mixSourceBuffers.length

        for (let offset = 0; offset < BUFFER_AUDIO_CLIP_SIZE; offset += 2) {
            let mixSample = 0
            for (let i = 0; i < mixSourceCount; i++) {
                mixSample += mixSourceBuffers[i].readInt16LE(offset)
            }

            mixBuffer.writeInt16LE(Math.round(mixSample/mixSourceCount), offset)
        }

        let encoder = new Lame({
            'output': 'buffer',
            'bitrate': 64,
            'raw': true,
            'sfreq': 48,
            'bitwidth': 16,
            'signed': true,
            'little-endian': true,
        }).setBuffer(mixBuffer)
        
        await encoder.encode()
        return encoder.getBuffer()
    }
    
    registerVoiceMonitor(monitor) {
        let recorder = monitor.transcriber.recorder
        this._recorderList.push(recorder)
        
        monitor.on('destroy', () => {
            setTimeout(this._removeRecorder, SpeechTranscriber.AUDIO_CLIP_SECONDS * 1000, recorder)
        })
    }

    _removeRecorder(recorder) {
        let index = this._recorderList.indexOf(recorder)
        if (index !== -1) {
            this._recorderList.splice(index, 1)
        }
    }
}

class VoiceMonitor extends EventEmitter {
    constructor(member, speechClient, stream) {
        super()
        this.member = member
        this.stream = stream
        this.transcriber = new SpeechTranscriber(speechClient)
        this.transcriber.setAudioReadStream(stream)
        this.transcriber.getPhrases = () => [].concat(...Array.from(this._transcribeEventMap.keys()).map(phraseSet => phraseSet.phrases)) 

        this._transcribeEventMap = new Map()

        // attach default listener
        this.transcriber.on('transcribe', data => {
            console.log(`<${member.displayName}>: "${data}"`)
        })
    }

    destroy() {
        this.emit('destroy')
        this.removeAllListeners()
        this._transcribeEventMap.clear()
        this.transcriber.destroy()
        this.stream.destroy()
    }

    addPhraseSet(phraseSet) {
        if (this._transcribeEventMap.has(phraseSet)) {
            return
        }
        
        const listener = (data, isFinal) => {
            if (phraseSet.hasPhraseSlice(data)) {
                console.log('phrase detected')
                this.emit('match', phraseSet, isFinal)
            }
        }

        this.transcriber.on('transcribe', listener)
        this._transcribeEventMap.set(phraseSet, listener)
    }

    removePhraseSet(phraseSet) {
        let listener = this._transcribeEventMap.get(phraseSet)
        if (listener) {
            this.transcriber.removeListener('transcribe', listener)
            this._transcribeEventMap.delete(phraseSet)
        }
    }
}

module.exports = GuildVoiceManager