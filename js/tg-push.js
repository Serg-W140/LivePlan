import { PlannerStore } from './store.js';

export class TgPushSync {
  // Сюда вставишь URL твоего бота, когда задеплоишь его (например, 'https://onrender.com')
  static BOT_SYNC_URL = 'https://https://life-planner-bot.labyt2.workers.dev/sync';

  static async pushScheduleToBot() {
    if (!this.BOT_SYNC_URL) return;
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!tgUser?.id) return;

    const payload = {
      chatId: tgUser.id,
      timezoneOffsetMin: new Date().getTimezoneOffset(), // чтобы бот знал твой часовой пояс
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
