import { PlannerStore } from './store.js';

export class TgPushSync {
  // ВСТАВЬ СЮДА СВОЙ АДРЕС ВОРКЕРА С /sync НА КОНЦЕ:
  static BOT_SYNC_URL = 'https://life-planner-bot.labyt2.workers.dev/sync';

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

  static async pushScheduleToBot() {
    if (!this.BOT_SYNC_URL || this.BOT_SYNC_URL.includes('ТВОЙ_ВОРКЕР')) return;

    const chatId = this.extractTelegramUserId();
    if (!chatId) return;

    const payload = {
      chatId,
      timezoneOffsetMin: new Date().getTimezoneOffset(),
      alarms: PlannerStore.getAlarms().filter((a) => a.enabled),
      events: PlannerStore.getEvents()
    };

    try {
      await fetch(this.BOT_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (_) {}
  }
}