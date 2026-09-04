(function () {
  const speechApi = {
    isSpeechSupported() {
      return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    },

    getVoices() {
      if (!this.isSpeechSupported()) {
        return [];
      }
      return window.speechSynthesis.getVoices();
    },

    ensureVoicesLoaded() {
      if (!this.isSpeechSupported()) {
        return;
      }
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
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
      const synthesis = window.speechSynthesis;
      synthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utterance.lang = lang;
      utterance.rate = Number(rate) || 0.8;
      utterance.pitch = 1;
      utterance.volume = 1;

      const normalizedLang = lang.toLowerCase();
      const voices = this.getVoices();
      if (normalizedLang.startsWith("mr")) {
        const marathiVoice = voices.find(voice => {
          const voiceLang = (voice.lang || "").toLowerCase();
          return voiceLang === "mr-in" || voiceLang.startsWith("mr");
        });
        if (marathiVoice) {
          utterance.voice = marathiVoice;
        }
      } else if (normalizedLang.startsWith("en")) {
        const englishVoice = voices.find(voice => (voice.lang || "").toLowerCase().startsWith("en"));
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
    }
  };

  window.speechUtils = speechApi;
  window.speakText = speechApi.speakText.bind(speechApi);
  window.speakMarathi = speechApi.speakMarathi.bind(speechApi);
  window.speakEnglish = speechApi.speakEnglish.bind(speechApi);
  window.isSpeechSupported = speechApi.isSpeechSupported.bind(speechApi);
})();
