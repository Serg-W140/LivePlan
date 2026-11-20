import { PlannerStore } from './store.js';

export class TgPushSync {
  // ВСТАВЬ СЮДА СВОЙ АДРЕС ВОРКЕРА С /sync НА КОНЦЕ:
  static BOT_SYNC_URL = 'https://life-planner-bot.labyt2.workers.dev/sync';

   static async pushScheduleToBot() {
    const tg = window.Telegram?.WebApp;
    const notify = (msg) => {
      if (tg?.showAlert) tg.showAlert(msg);
      else alert(msg);
    };

    if (!this.BOT_SYNC_URL || this.BOT_SYNC_URL.includes('ВСТАВЬ_СЮДА')) {
      notify('⚠️ Не вписан BOT_SYNC_URL в файле js/tg-push.js');
      return;
    }

    const tgUser = tg?.initDataUnsafe?.user;
    if (!tgUser?.id) {
      notify('⚠️ Нет Telegram user.id (запущено не через кнопку меню бота)');
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
      notify(resp.ok ? '✅ Успешно отправлено в бота!' : `❌ Ошибка сервера: ${resp.status}`);
    } catch (err) {
      notify(`❌ Ошибка сети (оператор блокирует workers.dev?): ${err.message}`);
    }
  }
}