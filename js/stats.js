import { PlannerStore } from './store.js';
import { I18n } from './i18n.js';

export class StatsManager {
  constructor() {
    this.dom = {
      streakBadge: document.getElementById('streakBadge'),
      statsDone30d: document.getElementById('statsDone30d'),
      statsActiveDays: document.getElementById('statsActiveDays'),
      statsHeatStrip: document.getElementById('statsHeatStrip')
    };
    this.render();
  }

  render() {
    if (!this.dom.streakBadge) return;

    const logs = PlannerStore.getLogs();
    const today = new Date();

    // 1. Подсчёт серии дней подряд (Streak)
    let streak = 0;
    const cursor = new Date(today);
    const todayKey = PlannerStore.getLocalDateStr(cursor);

    // Если сегодня ещё ничего не отмечено, проверяем со вчерашнего дня, чтобы серия не сгорала днём
    if (!logs[todayKey] || logs[todayKey].length === 0) {
      cursor.setDate(cursor.getDate() - 1);
    }

    while (true) {
      const key = PlannerStore.getLocalDateStr(cursor);
      if (Array.isArray(logs[key]) && logs[key].length > 0) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    // 2. Статистика за последние 14 дней (полоска активности) и 30 дней (счётчики)
    let totalDone30 = 0;
    let activeDays30 = 0;

    for (let i = 0; i < 30; i += 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = PlannerStore.getLocalDateStr(d);
      const count = Array.isArray(logs[key]) ? logs[key].length : 0;
      if (count > 0) {
        totalDone30 += count;
        activeDays30 += 1;
      }
    }

    this.dom.streakBadge.textContent = I18n.t('streakLabel', { count: streak });
    if (this.dom.statsDone30d) {
      this.dom.statsDone30d.textContent = I18n.t('statsDone30d', { count: totalDone30 });
    }
    if (this.dom.statsActiveDays) {
      this.dom.statsActiveDays.textContent = I18n.t('statsActiveDays', { count: activeDays30 });
    }

    // Отрисовка 14 последних дней в виде компактных квадратиков
    if (this.dom.statsHeatStrip) {
      const cells = Array.of();
      for (let i = 13; i >= 0; i -= 1) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = PlannerStore.getLocalDateStr(d);
        const count = Array.isArray(logs[key]) ? logs[key].length : 0;
        const level = count === 0 ? 0 : (count <= 2 ? 1 : 2);
        cells.push(`<span class="heat-cell lvl-${level}" title="${key}: ${count}"></span>`);
      }
      this.dom.statsHeatStrip.innerHTML = cells.join('');
    }
  }
}
