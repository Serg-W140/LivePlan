import { PlannerStore } from './store.js';
import { I18n } from './i18n.js';

export class TimerController {
  constructor(soundEngine, { onWorkoutFinished } = {}) {
    this.sound = soundEngine;
    this.onWorkoutFinished = onWorkoutFinished;

    this.intervalId = null;
    this.wakeLock = null;
    this.isRunning = false;

    this.queue = Array.of();
    this.currentIndex = 0;
    this.secondsLeft = 0;
    this.segmentEndTime = 0;
    this.activeWorkoutName = I18n.t('freeMode');
    this.activeEventUid = null;

    this.#cacheDOM();
    this.#restoreSettings();
    this.#bindEvents();
    this.loadFreeMode();
  }

  #cacheDOM() {
    this.dom = {
      display: document.getElementById('display'),
      exerciseTitle: document.getElementById('exerciseTitle'),
      statusText: document.getElementById('statusText'),
      timeText: document.getElementById('timeText'),
      roundText: document.getElementById('roundText'),
      nextText: document.getElementById('nextText'),
      startBtn: document.getElementById('startBtn'),
      resetBtn: document.getElementById('resetBtn'),
      presetsContainer: document.getElementById('presetsContainer'),
      quickSettings: document.getElementById('quickSettings'),
      roundsInput: document.getElementById('roundsInput'),
      workMin: document.getElementById('workMin'),
      workSec: document.getElementById('workSec'),
      restMin: document.getElementById('restMin'),
      restSec: document.getElementById('restSec'),
      prepSec: document.getElementById('prepSec'),
      soundType: document.getElementById('soundType'),
      voiceCheck: document.getElementById('voiceCheck'),
      warnCheck: document.getElementById('warnCheck'),
      tickCheck: document.getElementById('tickCheck'),
    };
  }

  #restoreSettings() {
    const s = PlannerStore.getSettings();
    if (this.dom.prepSec) this.dom.prepSec.value = s.prepSec;
    if (this.dom.soundType) this.dom.soundType.value = s.soundType;
    if (this.dom.voiceCheck) this.dom.voiceCheck.checked = s.voiceEnabled;
    if (this.dom.warnCheck) this.dom.warnCheck.checked = s.warnEnabled;
    if (this.dom.tickCheck) this.dom.tickCheck.checked = s.tickEnabled;
  }

  #saveAudioSettings() {
    PlannerStore.saveSettings({
      prepSec: Math.max(0, parseInt(this.dom.prepSec.value, 10) || 0),
      soundType: this.dom.soundType.value,
      voiceEnabled: this.dom.voiceCheck.checked,
      warnEnabled: this.dom.warnCheck.checked,
      tickEnabled: this.dom.tickCheck.checked
    });
  }

  #bindEvents() {
    this.dom.startBtn.addEventListener('click', () => this.toggle());
    this.dom.resetBtn.addEventListener('click', () => this.reset());

    Array.of(
      this.dom.prepSec,
      this.dom.soundType,
      this.dom.voiceCheck,
      this.dom.warnCheck,
      this.dom.tickCheck
    ).forEach((el) => {
      el?.addEventListener('change', () => {
        this.#saveAudioSettings();
        if (!this.isRunning && this.activeEventUid === null) {
          this.loadFreeMode();
        }
      });
    });

    this.dom.presetsContainer?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.id === 'testSoundBtn') {
        this.sound.play(this.dom.soundType.value);
        return;
      }
      if (btn.dataset.rounds) {
        this.dom.roundsInput.value = btn.dataset.rounds;
        this.dom.workMin.value = Math.floor(Number(btn.dataset.work) / 60);
        this.dom.workSec.value = Number(btn.dataset.work) % 60;
        this.dom.restMin.value = Math.floor(Number(btn.dataset.rest) / 60);
        this.dom.restSec.value = Number(btn.dataset.rest) % 60;
        this.dom.soundType.value = btn.dataset.sound;
        this.#saveAudioSettings();
        this.loadFreeMode();
      }
    });

    this.dom.quickSettings?.addEventListener('change', () => this.loadFreeMode());

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isRunning) {
        this.#requestWakeLock();
        this.#tick();
      }
    });
  }

  #buildQueue(workoutName, steps) {
    const wTitle = I18n.t(workoutName);
    const queue = Array.of();
    const prep = Math.max(0, parseInt(this.dom.prepSec.value, 10) || 0);
    const firstStep = steps.at(0);

    if (prep > 0 && firstStep) {
      const firstExName = I18n.t(firstStep.name);
      queue.push({
        phase: 'prep',
        title: wTitle,
        status: I18n.t('statusPrep'),
        duration: prep,
        roundInfo: I18n.t('firstExercise', { name: firstExName }),
        speak: I18n.t('speakPrep', { name: firstExName })
      });
    }

    steps.forEach((step, stepIdx) => {
      const stepName = I18n.t(step.name);
      for (let s = 1; s <= step.sets; s += 1) {
        queue.push({
          phase: 'work',
          title: stepName,
          status: I18n.t('statusWork'),
          duration: step.work,
          roundInfo: I18n.t('roundInfo', { curr: s, total: step.sets }),
          speak: I18n.t('speakWork', { name: stepName, set: s })
        });

        if (s < step.sets && step.rest > 0) {
          queue.push({
            phase: 'rest',
            title: stepName,
            status: I18n.t('statusRest'),
            duration: step.rest,
            roundInfo: I18n.t('nextSet', { curr: s + 1, total: step.sets }),
            speak: I18n.t('speakRest')
          });
        }
      }

      const nextStep = steps.at(stepIdx + 1);
      if (nextStep && step.afterRest > 0) {
        const nextExName = I18n.t(nextStep.name);
        queue.push({
          phase: 'rest',
          title: I18n.t('nextPrefix', { name: nextExName }),
          status: I18n.t('statusSwitch'),
          duration: step.afterRest,
          roundInfo: I18n.t('nextStepInfo', { curr: stepIdx + 2, total: steps.length }),
          speak: I18n.t('speakSwitch', { name: nextExName })
        });
      }
    });

    return queue;
  }

  loadFreeMode() {
    this.stop();
    this.activeWorkoutName = I18n.t('freeMode');
    this.activeEventUid = null;
    if (this.dom.quickSettings) this.dom.quickSettings.hidden = false;

    const rounds = Math.max(1, parseInt(this.dom.roundsInput.value, 10) || 1);
    const work = Math.max(1, (parseInt(this.dom.workMin.value, 10) || 0) * 60 + (parseInt(this.dom.workSec.value, 10) || 0));
    const rest = Math.max(0, (parseInt(this.dom.restMin.value, 10) || 0) * 60 + (parseInt(this.dom.restSec.value, 10) || 0));

    const freeSteps = Array.of({
      name: I18n.t('freeRound'),
      sets: rounds,
      work,
      rest,
      afterRest: 0
    });

    this.queue = this.#buildQueue(I18n.t('freeMode'), freeSteps);
    this.currentIndex = 0;
    this.secondsLeft = this.queue.at(0).duration;
    this.#renderIdle();
  }

  loadWorkoutPlan(workout, eventUid = null) {
    this.stop();
    this.activeWorkoutName = I18n.t(workout.name);
    this.activeEventUid = eventUid;
    if (this.dom.quickSettings) this.dom.quickSettings.hidden = true;
    this.queue = this.#buildQueue(workout.name, workout.steps);
    this.currentIndex = 0;
    this.secondsLeft = this.queue.at(0).duration;
    this.#renderIdle();
  }

  toggle() {
    this.sound.init();

    if (this.isRunning) {
      clearInterval(this.intervalId);
      this.isRunning = false;
      this.#releaseWakeLock();
      this.#setStartBtn(I18n.t('btnResume'), 'btn-start');
      return;
    }

    if (this.currentIndex >= this.queue.length) {
      this.currentIndex = 0;
      this.secondsLeft = this.queue.at(0).duration;
    }

    const seg = this.queue.at(this.currentIndex);
    if (this.secondsLeft === seg.duration && this.currentIndex === 0) {
      if (seg.phase === 'work') {
        this.sound.play(this.dom.soundType.value);
      }
      this.sound.speak(seg.speak, this.dom.voiceCheck.checked);
    }

    this.isRunning = true;
    this.segmentEndTime = Date.now() + this.secondsLeft * 1000;
    this.#requestWakeLock();
    this.#setStartBtn(I18n.t('btnPause'), 'btn-pause');
    this.#renderActive();
    this.intervalId = setInterval(() => this.#tick(), 250);
  }

  stop() {
    clearInterval(this.intervalId);
    this.isRunning = false;
    this.#releaseWakeLock();
    this.#setStartBtn(I18n.t('btnStart'), 'btn-start');
  }

  reset() {
    this.stop();
    this.currentIndex = 0;
    this.secondsLeft = this.queue.length > 0 ? this.queue.at(0).duration : 0;
    this.#renderIdle();
  }

  #tick() {
    const soundType = this.dom.soundType.value;
    const warn = this.dom.warnCheck.checked;
    const tick = this.dom.tickCheck.checked;
    const seg = this.queue.at(this.currentIndex);

    const remaining = Math.max(0, Math.ceil((this.segmentEndTime - Date.now()) / 1000));
    if (remaining === this.secondsLeft) return;
    this.secondsLeft = remaining;

    if (this.secondsLeft <= 0) {
      this.currentIndex += 1;

      if (this.currentIndex >= this.queue.length) {
        this.stop();
        this.sound.play(soundType);
        this.sound.speak(I18n.t('speakDone'), this.dom.voiceCheck.checked);
        this.dom.display.className = 'display';
        this.dom.statusText.textContent = I18n.t('statusDone');
        this.dom.timeText.textContent = '00:00';
        this.dom.nextText.textContent = '';

        if (this.activeEventUid && this.onWorkoutFinished) {
          this.onWorkoutFinished(this.activeEventUid);
        }
        return;
      }

      const nextSeg = this.queue.at(this.currentIndex);
      this.secondsLeft = nextSeg.duration;
      this.segmentEndTime = Date.now() + this.secondsLeft * 1000;
      this.sound.play(soundType);
      this.sound.speak(nextSeg.speak, this.dom.voiceCheck.checked);
      this.#renderActive();
      return;
    }

    if (seg.phase === 'work' && warn && this.secondsLeft === 10 && seg.duration > 15) {
      this.sound.play(soundType, 'warning');
        } else if ((seg.phase === 'prep' || seg.phase === 'rest') && this.secondsLeft <= 3) {
            this.sound.play(soundType, 'warning');
        } else if (seg.phase === 'work' && tick) {
            this.sound.play(soundType, 'tick');
        }
        this.#renderActive();
    }
    #renderIdle() {
        const first = this.queue.at(0);
        const second = this.queue.at(1);
        this.dom.display.className = 'display';
        this.dom.exerciseTitle.textContent = this.activeWorkoutName;
        this.dom.statusText.textContent = I18n.t('statusReady');
        this.dom.timeText.textContent = this.#formatTime(first.duration);
        this.dom.roundText.textContent = first.roundInfo;
        this.dom.nextText.textContent = second ? I18n.t('thenPrefix', { name: second.title }) : '';
    }
    #renderActive() {
        const seg = this.queue.at(this.currentIndex);
        const nextSeg = this.queue.at(this.currentIndex + 1);
        this.dom.display.className = `display ${seg.phase}`;
        this.dom.exerciseTitle.textContent = seg.title;
        this.dom.statusText.textContent = seg.status;
        this.dom.timeText.textContent = this.#formatTime(this.secondsLeft);
        this.dom.roundText.textContent = seg.roundInfo;
        this.dom.nextText.textContent = nextSeg
            ? I18n.t('nextSegment', { title: nextSeg.title, status: nextSeg.status.toLowerCase() })
            : I18n.t('finalStage');
    }
    async #requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
            } catch (_) {}
        }
    }
    #releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release().catch(() => {});
            this.wakeLock = null;
        }
    }
    #setStartBtn(text, cls) {
        this.dom.startBtn.textContent = text;
        this.dom.startBtn.className = `btn ${cls}`;
    }
    #formatTime(sec) {
        const m = String(Math.floor(sec / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        return `${m}:${s}`;
    }
}