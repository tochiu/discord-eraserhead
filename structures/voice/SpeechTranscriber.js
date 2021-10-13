const EventEmitter = require('events')

const AUDIO_CLIP_SECONDS = 30

const RECOGNIZE_STREAM_SILENCE_MS = 5000
const RECOGNIZE_STREAM_LIFETIME_MS = 210000
const RECOGNIZE_STREAM_WRITE_INTERVAL_MS = 250
const RECOGNIZE_STREAM_OPTIONS = {
    config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        audioChannelCount: 2
    },
    interimResults: true
}

const AUDIO_SINGLE_SAMPLE_BYTES = 2 * RECOGNIZE_STREAM_OPTIONS.config.audioChannelCount
const AUDIO_BYTES_PER_SECOND = AUDIO_SINGLE_SAMPLE_BYTES * RECOGNIZE_STREAM_OPTIONS.config.sampleRateHertz

const BUFFER_EMPTY = Buffer.alloc(AUDIO_BYTES_PER_SECOND * RECOGNIZE_STREAM_WRITE_INTERVAL_MS/1000, 0)
const BUFFER_AUDIO_CLIP_SIZE = AUDIO_BYTES_PER_SECOND * AUDIO_CLIP_SECONDS
const BUFFER_MAX_SIZE_BYTES = 5000000

class SpeechTranscriber extends EventEmitter {

    static AUDIO_CLIP_SECONDS = AUDIO_CLIP_SECONDS
    static BUFFER_AUDIO_CLIP_SIZE = BUFFER_AUDIO_CLIP_SIZE

    constructor(speechClient) {
        super()

        this.getPhrases = undefined
        this.recorder = new AudioClipRecorder()

        this._speechClient = speechClient

        this._audioBufferArray = []

        this._audioReadStream = null
        this._recognizeStream = null

        this._timeoutEnd = undefined
        this._timeoutStart = undefined
        this._timeoutWriteAudioToRecognizer = undefined

        this._writeAudioToRecognizer = this._writeAudioToRecognizer.bind(this)
        this._scheduleWriteAudioToRecognizer = this._scheduleWriteAudioToRecognizer.bind(this)

        this._onAudioRecognized = this._onAudioRecognized.bind(this)
        this._onAudioReceived = this._onAudioReceived.bind(this)
        
        this.start = this.start.bind(this)
        this.end = this.end.bind(this)
    }
    
    destroy() {
        this.removeAllListeners()
        this.end()

        this.getPhrases = undefined
        this._audioBufferArray = []

        if (this._audioReadStream) {
            this._audioReadStream.removeAllListeners()
            this._audioReadStream = null
        }
    }

    start() {
        this.end(true)
        this.recorder.setSilenceEnabled(false)

        let recognizeStreamConfig = RECOGNIZE_STREAM_OPTIONS

        let phrases = this.getPhrases && this.getPhrases()
        if (phrases && phrases.length) {
            recognizeStreamConfig = Object.assign({
                speechContexts: [{
                    phrases,
                    boost: 20
                }]
            }, RECOGNIZE_STREAM_OPTIONS)
        }

        this._recognizeStream = this._speechClient
            .streamingRecognize(recognizeStreamConfig)
            .on('data', this._onAudioRecognized)
            .on('error', e => {
                console.error(e)
                console.log("Attempting to reconnect...")
                this.start() // attempt to restart speech client
            })
        
        this._timeoutStart = setTimeout(this.start, RECOGNIZE_STREAM_LIFETIME_MS)
        this._scheduleWriteAudioToRecognizer()
        this._scheduleEndAudioRecognizer()
    }

    end(suppressEnableSilence) {
        if (!suppressEnableSilence) {
            this.recorder.setSilenceEnabled(true)
        }

        if (this._recognizeStream) {
            this._recognizeStream.removeAllListeners()
            this._recognizeStream.destroy()
            this._recognizeStream = null
        }

        if (this._timeoutStart) {
            clearTimeout(this._timeoutStart)
            this._timeoutStart = undefined 
        }

        this._clearEndAudioRecognizerSchedule()
        this._clearWriteAudioToRecognizerSchedule()
    }

    flush() {
        if (this._timeoutWriteAudioToRecognizer) {
            this._writeAudioToRecognizer()
        }
    }

    setAudioReadStream(audioReadStream) {
        if (this._audioReadStream) {
            this._audioReadStream.removeAllListeners()
            this._audioBufferArray = []
            this._audioReadStream = null
        }

        this._audioReadStream = audioReadStream

        if (audioReadStream) {
            audioReadStream.on('data', this._onAudioReceived)
        }
    }

    _scheduleEndAudioRecognizer() {
        if (this._timeoutEnd) {
            clearTimeout(this._timeoutEnd)
        }
        this._timeoutEnd = setTimeout(this.end, RECOGNIZE_STREAM_SILENCE_MS)
    }

    _clearEndAudioRecognizerSchedule() {
        if (this._timeoutEnd) {
            clearTimeout(this._timeoutEnd)
            this._timeoutEnd = undefined
        }
    }

    _scheduleWriteAudioToRecognizer() {
        if (this._timeoutWriteAudioToRecognizer) {
            clearTimeout(this._timeoutWriteAudioToRecognizer)
        }
        this._timeoutWriteAudioToRecognizer = setTimeout(this._writeAudioToRecognizer, RECOGNIZE_STREAM_WRITE_INTERVAL_MS)
    }

    _clearWriteAudioToRecognizerSchedule() {
        if (this._timeoutWriteAudioToRecognizer) {
            clearTimeout(this._timeoutWriteAudioToRecognizer)
            this._timeoutWriteAudioToRecognizer = undefined
        }
    }

    _writeAudioToRecognizer() {
        this._clearWriteAudioToRecognizerSchedule()

        if (this._recognizeStream) {
            let audioBuffer = Buffer.concat(this._audioBufferArray)
            if (audioBuffer.length > BUFFER_MAX_SIZE_BYTES) {
                let chunk = audioBuffer.slice(0, BUFFER_MAX_SIZE_BYTES)
                this._audioBufferArray = [audioBuffer.slice(BUFFER_MAX_SIZE_BYTES)]
                audioBuffer = chunk
            } else if (audioBuffer.length === 0) {
                audioBuffer = BUFFER_EMPTY
            } else {
                this._audioBufferArray = []
            }
            
            if (this._recognizeStream.write(audioBuffer)) {
                this._scheduleWriteAudioToRecognizer()
            } else {
                this._recognizeStream.once('drain', this._scheduleWriteAudioToRecognizer)
            }

            if (audioBuffer === BUFFER_EMPTY) {
                this.recorder.writeSilence(RECOGNIZE_STREAM_WRITE_INTERVAL_MS/1000)
            } else {
                this.recorder.write(audioBuffer)
            }
        } else {
            console.log("recognizeStream does not exist")
            this._scheduleWriteAudioToRecognizer()
        }
    }

    _onAudioRecognized(data) {
        let transcript = 
            data.results[0] && 
            data.results[0].alternatives[0] && 
            data.results[0].alternatives[0].transcript
        
        if (transcript) {
            this.emit("transcribe", transcript, data.results[0].isFinal)
        }
    }

    _onAudioReceived(buf) {
        if (!this._recognizeStream) {
            this.start()
        }

        this._scheduleEndAudioRecognizer()
        this._audioBufferArray.push(buf)
    }
}

class AudioClipRecorder {
    constructor() {
        this._silenceEnabled = false
        this._silenceTimestamp = undefined
        this._buffer = Buffer.alloc(BUFFER_AUDIO_CLIP_SIZE, 0)
    }

    write(audioBuffer) {
        let clipBufferLShift = Math.min(audioBuffer.length, BUFFER_AUDIO_CLIP_SIZE)
        if (clipBufferLShift < BUFFER_AUDIO_CLIP_SIZE) {
            this._buffer.copy(this._buffer, 0, clipBufferLShift, BUFFER_AUDIO_CLIP_SIZE)
        }

        audioBuffer.copy(
            this._buffer, 
            BUFFER_AUDIO_CLIP_SIZE - clipBufferLShift, 
            audioBuffer.length - clipBufferLShift, 
            audioBuffer.length
        )
    }

    writeSilence(seconds) {
        if (!seconds) {
            let now = Date.now()
            seconds = (now - this._silenceTimestamp)/1000
            this._silenceTimestamp = now
        }

        let audioBufferLShift = Math.min(AUDIO_BYTES_PER_SECOND*seconds, BUFFER_AUDIO_CLIP_SIZE)
        audioBufferLShift -= audioBufferLShift % AUDIO_SINGLE_SAMPLE_BYTES

        if (audioBufferLShift < BUFFER_AUDIO_CLIP_SIZE) {
            this._buffer.copy(this._buffer, 0, audioBufferLShift, BUFFER_AUDIO_CLIP_SIZE)
        }

        this._buffer.fill(0, BUFFER_AUDIO_CLIP_SIZE - audioBufferLShift)
    }

    getBuffer() {
        if (this._silenceEnabled) {
            this.writeSilence()
        }
        return this._buffer
    }

    setSilenceEnabled(isSilence) {
        if (this._silenceEnabled === isSilence) {
            return
        }

        this._silenceEnabled = isSilence

        if (isSilence) {
            this._silenceTimestamp = Date.now()
        } else if (this._silenceTimestamp) {
            this.writeSilence()
        }
    }
}

module.exports = SpeechTranscriber