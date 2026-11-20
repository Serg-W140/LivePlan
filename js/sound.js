import { I18n } from './i18n.js';

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.alarmLoopId = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (_) {}
    }
  }

  sendSystemNotification(title, bodyText = '') {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(Array.of(300, 150, 300, 150, 500));
      } catch (_) {}
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: bodyText,
          icon: './icon.png',
          tag: 'life-planner-alert',
          renotify: true
        });
      } catch (_) {}
    }
  }

  speak(text, enabled) {
    if (!enabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = I18n.lang === 'ru' ? 'ru-RU' : 'en-US';
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  }

  play(type, mode = 'main') {
    this.init();
    const now = this.ctx.currentTime;

    if (mode === 'tick') {
      this.#playTick(now);
      return;
    }
    if (mode === 'warning') {
      this.#playWarning(now);
      return;
    }

    switch (type) {
      case 'gong': this.#playGong(now); break;
      case 'whistle': this.#playWhistle(now); break;
      case 'melody': this.#playMelody(now); break;
      default: this.#playBeep(now);
    }
  }

  startAlarmLoop(type = 'melody', labelText = '') {
    this.stopAlarmLoop();
    const ring = () => {
      this.play(type);
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(Array.of(400, 200, 400));
        } catch (_) {}
      }
      if (labelText) this.speak(labelText, true);
    };
    ring();
    this.alarmLoopId = setInterval(ring, 4000);
  }

  stopAlarmLoop() {
    if (this.alarmLoopId) {
      clearInterval(this.alarmLoopId);
      this.alarmLoopId = null;
    }
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch (_) {}
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  #playTick(now) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.025);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  #playWarning(now) {
    Array.of(0, 0.15).forEach((delay) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now + delay);
      osc.frequency.exponentialRampToValueAtTime(300, now + delay + 0.08);
      gain.gain.setValueAtTime(0.6, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.1);
    });
  }

  #playGong(now) {
    const frequencies = Array.of(260, 390, 520, 780, 1040);
    frequencies.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.45 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 2.3);
    });
  }

  #playWhistle(now) {
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2800, now);
    lfo.frequency.setValueAtTime(35, now);
    lfoGain.gain.setValueAtTime(120, now);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.75);
    lfo.stop(now + 0.75);
  }

  #playBeep(now) {
    Array.of(0, 0.2, 0.4).forEach((delay) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now + delay);
      gain.gain.setValueAtTime(0.25, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.14);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.15);
    });
  }

  #playMelody(now) {
    const notes = Array.of(523.25, 659.25, 783.99, 1046.5);
    notes.forEach((freq, idx) => {
      const delay = idx * 0.16;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(0.3, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.55);
    });
  }
}
