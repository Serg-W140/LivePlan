import { PlannerStore } from './store.js';

export class TgPushSync {
  // ВСТАВЬ СЮДА СВОЙ АДРЕС ВОРКЕРА С /sync НА КОНЦЕ:
  static BOT_SYNC_URL = 'https://ТВОЙ_ВОРКЕР.workers.dev/sync';

  static async pushScheduleToBot(showDebug = false) {
    if (!this.BOT_SYNC_URL || this.BOT_SYNC_URL.includes('ТВОЙ_ВОРКЕР')) return;

    const tg = window.Telegram?.WebApp;
    const tgUser = tg?.initDataUnsafe?.user;
    if (!tgUser?.id) {
      if (showDebug && tg?.showAlert) tg.showAlert('Ошибка: Telegram не передал user.id (откройте через кнопку меню бота)');
      return;
    }

    const payload = {
      chatId: tgUser.id,
      timezoneOffsetMin: new Date().getTimezoneOffset(),
      alarms: PlannerStore.getAlarms().filter((a) => a.enabled),
      events: PlannerStore.getEvents()
    };

    try {
      const resp = await fetch(this.BOT_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (showDebug && tg?.showAlert) {
        tg.showAlert(resp.ok ? '✅ Синхронизировано с ботом!' : `❌ Ошибка сервера: ${resp.status}`);
      }
    } catch (err) {
      if (showDebug && tg?.showAlert) {
        tg.showAlert(`❌ Сеть недоступна (возможно, блокировка workers.dev оператором): ${err.message}`);
      }
    }
  }
}
