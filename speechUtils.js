(function () {
  const speechApi = {
    getSpeechSynthesis() {
      return window.speechSynthesis || null;
    },

    isSpeechSupported() {
      return !!("speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
    },

    isRecognitionSupported() {
      return !!(("SpeechRecognition" in window) || ("webkitSpeechRecognition" in window));
    },

    getVoices() {
      if (!this.isSpeechSupported()) {
        return [];
      }

      const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
      return voices || [];
    },

    getPreferredVoice(languageCodes) {
      const voices = this.getVoices();
      if (!voices.length) {
        return null;
      }

      const normalized = languageCodes.map(code => code.toLowerCase());
      return voices.find(voice => {
        const voiceName = (voice.lang || "").toLowerCase();
        return normalized.some(code => voiceName === code || voiceName.startsWith(code + "-"));
      }) || null;
    },

    ensureVoicesLoaded() {
      if (!this.isSpeechSupported()) {
        return;
      }

      const loadVoices = () => this.getVoices();
      loadVoices();
      if (typeof window.speechSynthesis.onvoiceschanged === "undefined") {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    },

    speakText(text, lang = "mr-IN", rate = 0.8) {
      if (!this.isSpeechSupported()) {
        return false;
      }

      const cleanedText = String(text || "").trim();
      if (!cleanedText) {
        return false;
      }

      this.ensureVoicesLoaded();

      const synthesis = this.getSpeechSynthesis();
      synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utterance.lang = lang;
      utterance.rate = Number(rate) || 0.8;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voices = this.getVoices();
      if (lang && lang.toLowerCase().startsWith("mr")) {
        const marathiVoice = voices.find(voice => /mr/i.test(voice.lang || "")) || this.getPreferredVoice(["mr-in", "mr-in-x-mra"]);
        if (marathiVoice) {
          utterance.voice = marathiVoice;
        }
      }

      if (!lang || lang.toLowerCase().startsWith("en")) {
        const englishVoice = voices.find(voice => /en/i.test(voice.lang || "")) || this.getPreferredVoice(["en-in", "en-us", "en-gb"]);
        if (englishVoice) {
          utterance.voice = englishVoice;
        }
      }

      synthesis.speak(utterance);
      return true;
    },

    speakMarathi(text, rate = 0.75) {
      return this.speakText(text, "mr-IN", rate);
    },

    speakEnglish(text, rate = 0.8) {
      return this.speakText(text, "en-IN", rate);
    },

    startVoiceRecognition({
      input,
      button,
      lang = "en-IN",
      onResult,
      onError,
      onEnd,
      onListening,
      timeoutMs = 10000
    } = {}) {
      if (!this.isRecognitionSupported()) {
        if (onError) {
          onError("unsupported");
        }
        return null;
      }

      const RecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new RecognitionConstructor();
      let listeningTimer = null;
      let sessionActive = true;

      const stopListening = () => {
        sessionActive = false;
        if (listeningTimer) {
          clearTimeout(listeningTimer);
          listeningTimer = null;
        }

        if (button) {
          button.textContent = "🎤 बोलून लिहा";
          button.disabled = false;
        }

        if (onEnd) {
          onEnd();
        }
      };

      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = event => {
        const transcript = Array.from(event.results)
          .map(result => result[0]?.transcript || "")
          .join(" ")
          .trim();

        if (transcript && onResult) {
          onResult(transcript);
        }

        if (sessionActive && listeningTimer) {
          clearTimeout(listeningTimer);
          listeningTimer = setTimeout(() => {
            if (recognition && typeof recognition.stop === "function") {
              try {
                recognition.stop();
              } catch (error) {
                // Ignore repeated stop attempts.
              }
            }
          }, timeoutMs);
        }
      };

      recognition.onerror = event => {
        const reason = event.error || "unknown";
        if (reason === "no-speech") {
          if (button) {
            button.textContent = "🔴 ऐकत आहे... 10s";
          }
          if (onListening) {
            onListening();
          }
          return;
        }

        if (onError) {
          onError(reason);
        }
      };

      recognition.onend = () => {
        if (!sessionActive) {
          stopListening();
          return;
        }

        if (button) {
          button.textContent = "🎤 बोलून लिहा";
          button.disabled = false;
        }

        try {
          if (sessionActive && recognition && typeof recognition.start === "function") {
            recognition.start();
          }
        } catch (error) {
          // Ignore restart attempts after a short pause.
        }
      };

      if (button) {
        button.textContent = "🔴 ऐकत आहे... 10s";
        button.disabled = false;
      }

      if (onListening) {
        onListening();
      }

      try {
        recognition.start();
        listeningTimer = setTimeout(() => {
          if (recognition && typeof recognition.stop === "function") {
            try {
              recognition.stop();
            } catch (error) {
              // Ignore timeout stop attempts.
            }
          }
        }, timeoutMs);
      } catch (error) {
        if (button) {
          button.textContent = "🎤 बोलून लिहा";
          button.disabled = false;
        }
        if (onError) {
          onError("start-failed");
        }
        return null;
      }

      const manualStop = () => {
        sessionActive = false;
        if (listeningTimer) {
          clearTimeout(listeningTimer);
          listeningTimer = null;
        }
        try {
          recognition.stop();
        } catch (error) {
          // Ignore stop errors.
        }
      };

      return {
        recognition,
        stop: manualStop,
        setButtonState: state => {
          if (!button) {
            return;
          }
          button.textContent = state;
          button.disabled = state === "⏳ समजून घेत आहे...";
        }
      };
    },

    stopVoiceRecognition(recognition) {
      if (!recognition) {
        return;
      }

      if (typeof recognition.stop === "function") {
        try {
          recognition.stop();
        } catch (error) {
          // Ignore stop errors.
        }
      }
    }
  };

  window.speechUtils = speechApi;
  window.speakText = speechApi.speakText.bind(speechApi);
  window.speakMarathi = speechApi.speakMarathi.bind(speechApi);
  window.speakEnglish = speechApi.speakEnglish.bind(speechApi);
  window.isSpeechSupported = speechApi.isSpeechSupported.bind(speechApi);
  window.isRecognitionSupported = speechApi.isRecognitionSupported.bind(speechApi);
})();
