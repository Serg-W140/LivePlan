import { PlannerStore } from './store.js';
import { I18n } from './i18n.js';

export class TodayView {
  constructor({ onRunWorkout, onDataChanged }) {
    this.onRunWorkout = onRunWorkout;
    this.onDataChanged = onDataChanged;
    this.selectedDate = new Date();
    this.viewMonthDate = new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), 1);

    this.#cacheDOM();
    this.#bindEvents();
    this.render();
    this.#startDayRolloverMonitor();
  }

  #cacheDOM() {
    this.dom = {
      todayDateLabel: document.getElementById('todayDateLabel'),
      todayProgressMeta: document.getElementById('todayProgressMeta'),
      todayProgressBar: document.getElementById('todayProgressBar'),
      todayItemsList: document.getElementById('todayItemsList'),
      toggleCalendarBtn: document.getElementById('toggleCalendarBtn'),
      calendarBox: document.getElementById('calendarBox'),
      calPrevMonthBtn: document.getElementById('calPrevMonthBtn'),
      calNextMonthBtn: document.getElementById('calNextMonthBtn'),
      calMonthTitle: document.getElementById('calMonthTitle'),
      calGrid: document.getElementById('calGrid'),
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
    this.dom.toggleCalendarBtn?.addEventListener('click', () => {
      this.dom.calendarBox.hidden = !this.dom.calendarBox.hidden;
      if (!this.dom.calendarBox.hidden) this.renderCalendar();
    });

    this.dom.calPrevMonthBtn?.addEventListener('click', () => {
      this.viewMonthDate.setMonth(this.viewMonthDate.getMonth() - 1);
      this.renderCalendar();
    });

    this.dom.calNextMonthBtn?.addEventListener('click', () => {
      this.viewMonthDate.setMonth(this.viewMonthDate.getMonth() + 1);
      this.renderCalendar();
    });

    this.dom.calGrid?.addEventListener('click', (e) => {
      const cell = e.target.closest('[data-cal-date]');
      if (!cell) return;
      const parts = cell.dataset.calDate.split('-');
      this.selectedDate = new Date(Number(parts.at(0)), Number(parts.at(1)) - 1, Number(parts.at(2)));
      this.render();
    });

    this.dom.todayItemsList.addEventListener('click', (e) => {
      const checkBtn = e.target.closest('[data-toggle-uid]');
      const runBtn = e.target.closest('[data-run-uid]');

      if (checkBtn) {
        const uid = checkBtn.dataset.toggleUid;
        PlannerStore.toggleCompleted(PlannerStore.getLocalDateStr(this.selectedDate), uid);
        this.render();
      } else if (runBtn) {
        const uid = runBtn.dataset.runUid;
        const dayItems = PlannerStore.getItemsForDate(this.selectedDate);
        const item = dayItems.find((i) => i.uid === uid);
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

  renderCalendar() {
    if (!this.dom.calGrid) return;
    const year = this.viewMonthDate.getFullYear();
    const month = this.viewMonthDate.getMonth();
    const locale = I18n.lang === 'ru' ? 'ru-RU' : 'en-US';

    this.dom.calMonthTitle.textContent = this.viewMonthDate.toLocaleDateString(locale, {
      month: 'long',
      year: 'numeric'
    });

    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Пн = 0 ... Вс = 6
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const todayStr = PlannerStore.getLocalDateStr(new Date());
    const selectedStr = PlannerStore.getLocalDateStr(this.selectedDate);

    const wdHeaders = Array.of(1, 2, 3, 4, 5, 6, 0)
      .map((d) => `<div class="cal-head">${I18n.t('wdShort' + d)}</div>`)
      .join('');

    let cells = '';
    for (let i = 0; i < startOffset; i += 1) {
      cells += '<div class="cal-cell empty"></div>';
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const cellDate = new Date(year, month, day);
      const cellStr = PlannerStore.getLocalDateStr(cellDate);
      const dayItems = PlannerStore.getItemsForDate(cellDate);
      const hasEvents = dayItems.some((item) => item.kind !== 'alarm');
      const hasBirthday = dayItems.some((item) => item.kind === 'birthday');

      const cls = Array.of('cal-cell');
      if (cellStr === todayStr) cls.push('today');
      if (cellStr === selectedStr) cls.push('selected');

      const dot = hasBirthday
        ? '<span class="cal-dot birthday"></span>'
        : (hasEvents ? '<span class="cal-dot"></span>' : '');

      cells += `<button type="button" class="${cls.join(' ')}" data-cal-date="${cellStr}">${day}${dot}</button>`;
    }

    this.dom.calGrid.innerHTML = wdHeaders + cells;
  }

  render() {
    const locale = I18n.lang === 'ru' ? 'ru-RU' : 'en-US';
    this.dom.todayDateLabel.textContent = this.selectedDate.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    const items = PlannerStore.getItemsForDate(this.selectedDate);
    const total = items.length;
    const doneCount = items.filter((i) => i.done).length;
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    this.dom.todayProgressMeta.textContent = I18n.t('progressMeta', { done: doneCount, total });
    this.dom.todayProgressBar.style.width = `${pct}%`;

    if (!this.dom.calendarBox?.hidden) {
      this.renderCalendar();
    }

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
        return `<div class="list-item" style="padding: 8px 10px;"> <span><strong>${item.time}</strong> — ${item.title}</span> ${canDelete ?`✕ `: ''} </div>`;
    })
    .join('');
    }

    #startDayRolloverMonitor() {
    this.lastTodayStr = PlannerStore.getLocalDateStr(new Date());

    const checkNewDay = () => {
      const now = new Date();
      const currentStr = PlannerStore.getLocalDateStr(now);
      if (currentStr !== this.lastTodayStr) {
        this.lastTodayStr = currentStr;
        this.selectedDate = now;
        this.viewMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
        this.render();
      }
    };

    setInterval(checkNewDay, 30000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkNewDay();
      }
    });
  }

}