import { PlannerStore } from './store.js';
import { I18n } from './i18n.js';

export class TodayView {
  constructor({ onRunWorkout, onDataChanged }) {
    this.onRunWorkout = onRunWorkout;
    this.onDataChanged = onDataChanged;

    this.#cacheDOM();
    this.#bindEvents();
    this.render();
  }

  #cacheDOM() {
    this.dom = {
      todayDateLabel: document.getElementById('todayDateLabel'),
      todayProgressMeta: document.getElementById('todayProgressMeta'),
      todayProgressBar: document.getElementById('todayProgressBar'),
      todayItemsList: document.getElementById('todayItemsList'),
      openEveningBtn: document.getElementById('openEveningBtn'),
      eveningModal: document.getElementById('eveningModal'),
      closeEveningBtn: document.getElementById('closeEveningBtn'),
      carryOverBox: document.getElementById('carryOverBox'),
      carryOverTitle: document.getElementById('carryOverTitle'),
      carryOverAllBtn: document.getElementById('carryOverAllBtn'),
      tomorrowTaskInput: document.getElementById('tomorrowTaskInput'),
      tomorrowTaskTime: document.getElementById('tomorrowTaskTime'),
      addTomorrowTaskBtn: document.getElementById('addTomorrowTaskBtn'),
      tomorrowItemsList: document.getElementById('tomorrowItemsList'),
    };
  }

  #bindEvents() {
    this.dom.todayItemsList.addEventListener('click', (e) => {
      const checkBtn = e.target.closest('[data-toggle-uid]');
      const runBtn = e.target.closest('[data-run-uid]');

      if (checkBtn) {
        const uid = checkBtn.dataset.toggleUid;
        PlannerStore.toggleCompleted(PlannerStore.getLocalDateStr(), uid);
        this.render();
      } else if (runBtn) {
        const uid = runBtn.dataset.runUid;
        const todayItems = PlannerStore.getItemsForDate(new Date());
        const item = todayItems.find((i) => i.uid === uid);
        if (item?.workout) {
          this.onRunWorkout(item.workout, item.uid);
        }
      }
    });

    this.dom.openEveningBtn.addEventListener('click', () => {
      this.renderTomorrowModal();
      this.dom.eveningModal.hidden = false;
    });

    this.dom.closeEveningBtn.addEventListener('click', () => {
      this.dom.eveningModal.hidden = true;
    });

    this.dom.eveningModal.addEventListener('click', (e) => {
      if (e.target === this.dom.eveningModal) {
        this.dom.eveningModal.hidden = true;
      }
    });

    this.dom.carryOverAllBtn.addEventListener('click', () => {
      const todayItems = PlannerStore.getItemsForDate(new Date());
      const unfinished = todayItems.filter((i) => !i.done && i.kind !== 'alarm');
      const tomorrowStr = PlannerStore.getTomorrowDateStr();

      unfinished.forEach((item) => {
        if (item.raw?.ruleType === 'once') {
          PlannerStore.upsertEvent({ id: item.sourceId, date: tomorrowStr });
        } else {
          PlannerStore.upsertEvent({
            title: item.title,
            category: item.kind,
            ruleType: 'once',
            date: tomorrowStr,
            time: item.time,
            remindBefore: item.remindBefore,
            workoutId: item.raw?.workoutId || null
          });
        }
      });

      this.render();
      this.renderTomorrowModal();
      this.onDataChanged();
    });

    this.dom.addTomorrowTaskBtn.addEventListener('click', () => {
      const title = this.dom.tomorrowTaskInput.value.trim();
      if (!title) return;
      const time = this.dom.tomorrowTaskTime.value || '10:00';
      const tomorrowStr = PlannerStore.getTomorrowDateStr();

      PlannerStore.upsertEvent({
        title,
        category: 'event',
        ruleType: 'once',
        date: tomorrowStr,
        time,
        remindBefore: PlannerStore.getSettings().defaultRemindBefore ?? 60
      });

      this.dom.tomorrowTaskInput.value = '';
      this.renderTomorrowModal();
      this.onDataChanged();
    });

    this.dom.tomorrowItemsList.addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-del-tmr]');
      if (!delBtn) return;
      PlannerStore.removeEvent(delBtn.dataset.delTmr);
      this.renderTomorrowModal();
      this.onDataChanged();
    });
  }

  render() {
    const now = new Date();
    const locale = I18n.lang === 'ru' ? 'ru-RU' : 'en-US';
    this.dom.todayDateLabel.textContent = now.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    const items = PlannerStore.getItemsForDate(now);
    const total = items.length;
    const doneCount = items.filter((i) => i.done).length;
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    this.dom.todayProgressMeta.textContent = I18n.t('progressMeta', { done: doneCount, total });
    this.dom.todayProgressBar.style.width = `${pct}%`;

    if (items.length === 0) {
      this.dom.todayItemsList.innerHTML = `<div class="list-item"><small style="color:#888">${I18n.t('noItemsToday')}</small></div>`;
      return;
    }

    this.dom.todayItemsList.innerHTML = items
      .map((item) => {
        const iconMap = {
          alarm: '⏰',
          birthday: '🎂',
          workout: '🏋️',
          event: '📌'
        };
        const icon = iconMap[item.kind] || '📌';
        const remindBadge = item.remindBefore > 0
          ? `<span class="badge">${I18n.t('remindMeta', { min: item.remindBefore })}</span>`
          : '';
        const extraBadge = item.meta ? `<span class="badge badge-accent">${item.meta}</span>` : '';
        const runBtn = item.workout
          ? `<button type="button" class="btn btn-start btn-xs" data-run-uid="${item.uid}">▶</button>`
          : '';

        return `
          <div class="list-item ${item.done ? 'item-done' : ''}">
            <div class="row" style="gap: 10px; flex: 1;">
              <button type="button" class="check-circle ${item.done ? 'checked' : ''}" data-toggle-uid="${item.uid}">
                ${item.done ? '✓' : ''}
              </button>
              <div class="list-item-info">
                <span><strong>${item.time}</strong> ${icon} <span class="item-title-text">${item.title}</span></span>
                <div class="row" style="justify-content: flex-start; gap: 6px; margin-top: 2px;">
                  ${extraBadge}
                  ${remindBadge}
                </div>
              </div>
            </div>
            <div class="item-actions">
              ${runBtn}
            </div>
          </div>`;
      })
      .join('');
  }

  renderTomorrowModal() {
    const todayItems = PlannerStore.getItemsForDate(new Date());
    const unfinished = todayItems.filter((i) => !i.done && i.kind !== 'alarm');

    if (unfinished.length > 0) {
      this.dom.carryOverBox.hidden = false;
      this.dom.carryOverTitle.textContent = I18n.t('carryOverTitle', { count: unfinished.length });
    } else {
      this.dom.carryOverBox.hidden = true;
    }

    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowItems = PlannerStore.getItemsForDate(tomorrowDate);

    if (tomorrowItems.length === 0) {
      this.dom.tomorrowItemsList.innerHTML = `<small style="color:#888">${I18n.t('noItemsTomorrow')}</small>`;
      return;
    }

    this.dom.tomorrowItemsList.innerHTML = tomorrowItems
      .map((item) => {
        const canDelete = item.raw?.ruleType === 'once';
        return `
          <div class="list-item" style="padding: 8px 10px;">
            <span><strong>${item.time}</strong> — ${item.title}</span>
            ${canDelete ? `<button type="button" class="btn btn-danger btn-xs" data-del-tmr="${item.sourceId}">✕</button>` : ''}
          </div>`;
      })
      .join('');
  }
}
