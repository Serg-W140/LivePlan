import { PlannerStore } from './store.js';

export class TgPushSync {
  // ВСТАВЬ СЮДА СВОЙ АДРЕС ВОРКЕРА С /sync НА КОНЦЕ:
  static BOT_BASE_URL = 'https://life-planner-bot.labyt2.workers.dev';

    static #setBadge(icon) {
    const btn = document.getElementById('langToggleBtn');
    if (!btn) return;
    const base = btn.textContent.split(' ').at(0);
    btn.textContent = `${base} ${icon}`;
  }

  static extractTelegramUserId() {
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user?.id) {
      return tg.initDataUnsafe.user.id;
    }

    try {
      let rawInitData = tg?.initData || '';
      if (!rawInitData && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        rawInitData = hashParams.get('tgWebAppData') || '';
      }
      if (!rawInitData && window.location.search) {
        const queryParams = new URLSearchParams(window.location.search);
        rawInitData = queryParams.get('tgWebAppData') || '';
      }

      if (rawInitData) {
        const params = new URLSearchParams(rawInitData);
        const userJson = params.get('user');
        if (userJson) {
          const userObj = JSON.parse(userJson);
          if (userObj?.id) return userObj.id;
        }
      }
    } catch (_) {}

    return null;
  }

  static async pullScheduleFromBot() {
    if (!this.BOT_BASE_URL || this.BOT_BASE_URL.includes('ТВОЙ_ВОРКЕР')) {
      this.#setBadge('⚠️');
      return false;
    }
    const chatId = this.extractTelegramUserId();
    if (!chatId) return false;

    try {
      const resp = await fetch(`${this.BOT_BASE_URL}/load?chatId=${chatId}`);
      if (!resp.ok) {
        this.#setBadge('❌');
        return false;
      }
      const remote = await resp.json();
      this.#setBadge('☁️');
      if (remote.empty) return false;

      if (Array.isArray(remote.allAlarms)) {
        localStorage.setItem(PlannerStore.KEYS.ALARMS, JSON.stringify(remote.allAlarms));
      }
      if (Array.isArray(remote.events)) {
        localStorage.setItem(PlannerStore.KEYS.EVENTS, JSON.stringify(remote.events));
      }
      if (Array.isArray(remote.workouts)) {
        localStorage.setItem(PlannerStore.KEYS.WORKOUTS, JSON.stringify(remote.workouts));
      }
      if (Array.isArray(remote.exercises)) {
        localStorage.setItem(PlannerStore.KEYS.EXERCISES, JSON.stringify(remote.exercises));
      }
      if (remote.logs && typeof remote.logs === 'object') {
        localStorage.setItem(PlannerStore.KEYS.LOGS, JSON.stringify(remote.logs));
      }
      return true;
    } catch (_) {
      this.#setBadge('❌');
      return false;
    }
  }

  static async pushScheduleToBot() {
    if (!this.BOT_BASE_URL || this.BOT_BASE_URL.includes('ТВОЙ_ВОРКЕР')) {
      this.#setBadge('⚠️');
      return;
    }
    const chatId = this.extractTelegramUserId();
    if (!chatId) return;

    const allAlarms = PlannerStore.getAlarms();
    const payload = {
      chatId,
      timezoneOffsetMin: new Date().getTimezoneOffset(),
      alarms: allAlarms.filter((a) => a.enabled),
      allAlarms,
      events: PlannerStore.getEvents(),
      workouts: PlannerStore.getWorkouts(),
      exercises: PlannerStore.getExercises(),
      logs: PlannerStore.getLogs()
    };

    try {
      const resp = await fetch(`${this.BOT_BASE_URL}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      this.#setBadge(resp.ok ? '☁️' : '❌');
    } catch (_) {
      this.#setBadge('❌');
    }
  }
}