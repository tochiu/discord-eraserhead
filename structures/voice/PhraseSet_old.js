const WORD_SELF_KEY = "[__SELF__]"
const PARSE_WORDS_REGEX = /\w+(['-]\w+)*/g
const SPLIT_WORDS_REGEX = /[^\s+]+/g

class PhraseSet {
    static getWords(phrase) {
        phrase = phrase.toLowerCase()
        let words = phrase.match(PARSE_WORDS_REGEX)
        let split = phrase.match(SPLIT_WORDS_REGEX)

        if (!words || !split || words.length !== split.length || words.join() !== split.join()) {
            return
        }

        return words
    }
    
    constructor(phrases) {
        this._lookup = {}
        this.phrases = []
        this.wordCount = 0

        if (phrases) {
            for (const phrase of phrases) {
                this.addPhrase(phrase)
            }
        }
    }

    hasPhraseSlice(phrase) {
        let words = PhraseSet.getWords(phrase)
        if (!words) {
            return false
        }

        for (let i = 0; i < words.length; i++) {
            let subLookup = this._lookup
            for (let j = i; j < words.length; j++) {
                let wordLookup = subLookup[words[j]]
                if (wordLookup) {
                    if ((typeof wordLookup) === "object") {
                        if (wordLookup[WORD_SELF_KEY]) {
                            return true
                        } else {
                            subLookup = wordLookup
                        }
                    } else {
                        return true
                    }
                } else {
                    break
                }
            }
        }

        return false
    }

    addPhrase(phrase) {
        let words = PhraseSet.getWords(phrase)
        if (!words) {
            return false
        }

        for (const word of words) {
            if (word.length > 100) {
                return false
            }
        }
        
        let subLookup = this._lookup
        
        for (const [index, word] of words.entries()) {
            let wordLookup = subLookup[word]
            let wordLookupType = typeof wordLookup

            if (index === words.length - 1) {
                if (wordLookupType === "object") {
                    if (wordLookup[WORD_SELF_KEY]) {
                        return false
                    } else {
                        wordLookup[WORD_SELF_KEY] = true
                    }
                } else if (wordLookup) {
                    return false
                } else {
                    subLookup[word] = true
                }
            } else if (wordLookup) {
                if (wordLookupType === "object") {
                    subLookup = wordLookup
                } else {
                    let newSubLookup = {
                        [WORD_SELF_KEY]: true
                    }
                    subLookup[word] = newSubLookup
                    subLookup = newSubLookup
                }
            } else {
                let newSubLookup = {}
                subLookup[word] = newSubLookup
                subLookup = newSubLookup
            }
        }

        this.phrases.push(words.join(' '))
        this.wordCount += words.length
        return true
    }

    removePhrase(phrase) {
        let words = PhraseSet.getWords(phrase)
        if (!words) {
            return false
        }
        
        let indexPhrase = this.phrases.indexOf(words.join(' '))

        if (indexPhrase === -1) {
            return false
        } else {
            this.phrases.splice(indexPhrase, 1)
            this._removeWord(words, 0, this._lookup)
        }

        this.wordCount -= words.length
        return true
    }

    _removeWord(words, index, subLookup) {
        let word = words[index]
        let wordLookup = subLookup[word]
        let wordLookupType = typeof wordLookup

        if (wordLookup) {

            if (index === words.length - 1) {
                if (wordLookupType === "object") {
                    delete wordLookup[WORD_SELF_KEY]
                    if (Object.keys(wordLookup).length === 0) {
                        delete subLookup[word]
                    }
                } else {
                    delete subLookup[word]
                }
            } else if (wordLookupType === "object") {
                this._removeWord(words, index + 1, wordLookup)
                if (Object.keys(wordLookup).length === 0) {
                    delete subLookup[word]
                }
            }
        }

        
    }
}

module.exports = PhraseSet