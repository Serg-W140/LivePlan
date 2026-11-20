import { PlannerStore } from './store.js';
import { I18n } from './i18n.js';

export class PlannerManager {
  constructor(soundEngine, { onDataChanged }) {
    this.sound = soundEngine;
    this.onDataChanged = onDataChanged;
    this.editingEventId = null;
    this.triggeredKeys = new Set();
    this.activeRingingItem = null;

    this.#cacheDOM();
    this.#bindEvents();
    this.render();
    this.#startClockMonitor();
  }

  #cacheDOM() {
    this.dom = {
      alarmTimeInput: document.getElementById('alarmTimeInput'),
      alarmLabelInput: document.getElementById('alarmLabelInput'),
      alarmSoundSelect: document.getElementById('alarmSoundSelect'),
      alarmDaysGroup: document.getElementById('alarmDaysGroup'),
      saveAlarmBtn: document.getElementById('saveAlarmBtn'),
      alarmsList: document.getElementById('alarmsList'),

      eventFormHeading: document.getElementById('eventFormHeading'),
      eventTitleInput: document.getElementById('eventTitleInput'),
      eventCategorySelect: document.getElementById('eventCategorySelect'),
      eventWorkoutRow: document.getElementById('eventWorkoutRow'),
      eventWorkoutSelect: document.getElementById('eventWorkoutSelect'),
      eventRuleSelect: document.getElementById('eventRuleSelect'),
      eventTimeInput: document.getElementById('eventTimeInput'),
      eventRemindInput: document.getElementById('eventRemindInput'),

      ruleOnceBox: document.getElementById('ruleOnceBox'),
      eventDateInput: document.getElementById('eventDateInput'),
      ruleWeeklyBox: document.getElementById('ruleWeeklyBox'),
      eventDaysGroup: document.getElementById('eventDaysGroup'),
      ruleMonthlyBox: document.getElementById('ruleMonthlyBox'),
      eventMonthDayInput: document.getElementById('eventMonthDayInput'),
      ruleYearlyBox: document.getElementById('ruleYearlyBox'),
      eventYearMonthSelect: document.getElementById('eventYearMonthSelect'),
      eventYearDayInput: document.getElementById('eventYearDayInput'),
      eventBirthYearInput: document.getElementById('eventBirthYearInput'),
      ruleCycleBox: document.getElementById('ruleCycleBox'),
      eventCycleGapInput: document.getElementById('eventCycleGapInput'),
      eventCycleStartInput: document.getElementById('eventCycleStartInput'),

      saveEventBtn: document.getElementById('saveEventBtn'),
      cancelEventEditBtn: document.getElementById('cancelEventEditBtn'),
      eventsList: document.getElementById('eventsList'),
      exportIcsBtn: document.getElementById('exportIcsBtn'),

      ringingModal: document.getElementById('ringingModal'),
      ringingSubtitle: document.getElementById('ringingSubtitle'),
      ringingEventTitle: document.getElementById('ringingEventTitle'),
      snoozeRingBtn: document.getElementById('snoozeRingBtn'),
      dismissRingBtn: document.getElementById('dismissRingBtn'),
    };
  }

  #bindEvents() {
    Array.of(this.dom.alarmDaysGroup, this.dom.eventDaysGroup).forEach((group) => {
      group?.addEventListener('click', (e) => {
        const chip = e.target.closest('.day-chip');
        if (chip) chip.classList.toggle('active');
      });
    });

    this.dom.saveAlarmBtn.addEventListener('click', () => {
      this.sound.requestNotificationPermission();
      const time = this.dom.alarmTimeInput.value || '07:30';
      const label = this.dom.alarmLabelInput.value.trim();
      const sound = this.dom.alarmSoundSelect.value;
      const days = this.#getSelectedDays(this.dom.alarmDaysGroup);

      PlannerStore.upsertAlarm({ time, label, days, sound, enabled: true });
      this.dom.alarmLabelInput.value = '';
      this.#clearSelectedDays(this.dom.alarmDaysGroup);
      this.renderAlarms();
      this.onDataChanged();
    });

    this.dom.alarmsList.addEventListener('click', (e) => {
      const toggleEl = e.target.closest('[data-alarm-toggle]');
      const delBtn = e.target.closest('[data-alarm-del]');

      if (toggleEl) {
        const id = toggleEl.dataset.alarmToggle;
        const alarms = PlannerStore.getAlarms();
        const found = alarms.find((a) => a.id === id);
        if (found) {
          PlannerStore.upsertAlarm({ id, enabled: !found.enabled });
          this.renderAlarms();
          this.onDataChanged();
        }
      } else if (delBtn) {
        if (!confirm(I18n.t('confirmDelete'))) return;
        const list = PlannerStore.getAlarms().filter((a) => a.id !== delBtn.dataset.alarmDel);
        PlannerStore.saveAlarms(list);
        this.renderAlarms();
        this.onDataChanged();
      }
    });

    this.dom.eventCategorySelect.addEventListener('change', () => this.#updateEventFormVisibility());
    this.dom.eventRuleSelect.addEventListener('change', () => this.#updateEventFormVisibility());

    this.dom.saveEventBtn.addEventListener('click', () => this.#saveEvent());
    this.dom.cancelEventEditBtn.addEventListener('click', () => this.#resetEventForm());

    this.dom.eventsList.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-ev-edit]');
      const delBtn = e.target.closest('[data-ev-del]');

      if (editBtn) {
        const ev = PlannerStore.getEvents().find((item) => item.id === editBtn.dataset.evEdit);
        if (ev) this.#startEditEvent(ev);
      } else if (delBtn) {
        if (!confirm(I18n.t('confirmDelete'))) return;
        const id = delBtn.dataset.evDel;
        PlannerStore.removeEvent(id);
        if (this.editingEventId === id) this.#resetEventForm();
        this.renderEvents();
        this.onDataChanged();
      }
    });

    this.dom.exportIcsBtn?.addEventListener('click', () => this.#exportToICS());

    this.dom.dismissRingBtn.addEventListener('click', () => {
      this.sound.stopAlarmLoop();
      this.dom.ringingModal.hidden = true;
      this.activeRingingItem = null;
    });

    this.dom.snoozeRingBtn.addEventListener('click', () => {
      this.sound.stopAlarmLoop();
      this.dom.ringingModal.hidden = true;
      if (this.activeRingingItem) {
        const snoozeAt = Date.now() + 10 * 60 * 1000;
        const itemCopy = { ...this.activeRingingItem };
        setTimeout(() => {
          this.#triggerRing(itemCopy, 0);
        }, Math.max(1000, snoozeAt - Date.now()));
      }
      this.activeRingingItem = null;
    });
  }

  #getSelectedDays(container) {
    const selected = Array.of();
    container.querySelectorAll('.day-chip.active').forEach((chip) => {
      selected.push(Number(chip.dataset.day));
    });
    return selected;
  }

  #setSelectedDays(container, daysArr = Array.of()) {
    container.querySelectorAll('.day-chip').forEach((chip) => {
      const d = Number(chip.dataset.day);
      chip.classList.toggle('active', daysArr.includes(d));
    });
  }

  #clearSelectedDays(container) {
    container.querySelectorAll('.day-chip').forEach((chip) => chip.classList.remove('active'));
  }

  #updateEventFormVisibility() {
    const cat = this.dom.eventCategorySelect.value;
    const rule = this.dom.eventRuleSelect.value;

    this.dom.eventWorkoutRow.hidden = cat !== 'workout';
    this.dom.ruleOnceBox.hidden = rule !== 'once';
    this.dom.ruleWeeklyBox.hidden = rule !== 'weekly';
    this.dom.ruleMonthlyBox.hidden = rule !== 'monthly';
    this.dom.ruleYearlyBox.hidden = rule !== 'yearly';
    this.dom.ruleCycleBox.hidden = rule !== 'cycle';
  }

  #startEditEvent(ev) {
    this.editingEventId = ev.id;
    this.dom.eventFormHeading.textContent = I18n.t('eventFormTitleEdit');
    this.dom.saveEventBtn.textContent = I18n.t('btnUpdateEvent');
    this.dom.cancelEventEditBtn.hidden = false;

    this.dom.eventTitleInput.value = ev.title || '';
    this.dom.eventCategorySelect.value = ev.category || 'event';
    this.dom.eventWorkoutSelect.value = ev.workoutId || '';
    this.dom.eventRuleSelect.value = ev.ruleType || 'once';
    this.dom.eventTimeInput.value = ev.time || '09:00';
    this.dom.eventRemindInput.value = ev.remindBefore !== undefined ? ev.remindBefore : 60;

    if (ev.date) this.dom.eventDateInput.value = ev.date;
    this.#setSelectedDays(this.dom.eventDaysGroup, ev.days || Array.of());
    if (ev.dayOfMonth) this.dom.eventMonthDayInput.value = ev.dayOfMonth;
    if (ev.month) this.dom.eventYearMonthSelect.value = ev.month;
    if (ev.day) this.dom.eventYearDayInput.value = ev.day;
    this.dom.eventBirthYearInput.value = ev.year || '';
    if (ev.gap) this.dom.eventCycleGapInput.value = ev.gap;
    if (ev.startDate) this.dom.eventCycleStartInput.value = ev.startDate;

    this.#updateEventFormVisibility();
    this.dom.eventFormHeading.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  #resetEventForm() {
    this.editingEventId = null;
    this.dom.eventFormHeading.textContent = I18n.t('eventFormTitleNew');
    this.dom.saveEventBtn.textContent = I18n.t('btnSaveEvent');
    this.dom.cancelEventEditBtn.hidden = true;

    this.dom.eventTitleInput.value = '';
    this.dom.eventCategorySelect.value = 'event';
    this.dom.eventRuleSelect.value = 'once';
    this.dom.eventDateInput.value = PlannerStore.getLocalDateStr();
    this.dom.eventTimeInput.value = '09:00';
    this.dom.eventRemindInput.value = PlannerStore.getSettings().defaultRemindBefore ?? 60;
    this.dom.eventBirthYearInput.value = '';
    this.#clearSelectedDays(this.dom.eventDaysGroup);
    this.#updateEventFormVisibility();
  }

  #saveEvent() {
    this.sound.requestNotificationPermission();
    const category = this.dom.eventCategorySelect.value;
    const ruleType = this.dom.eventRuleSelect.value;
    const workoutId = category === 'workout' ? this.dom.eventWorkoutSelect.value : null;
    let title = this.dom.eventTitleInput.value.trim();

    if (!title && workoutId) {
      const w = PlannerStore.getWorkouts().find((item) => item.id === workoutId);
      if (w) title = w.name;
    }

    if (!title) {
        alert(I18n.t('alertFillEvent'));
    return;
    }
    const remindVal = parseInt(this.dom.eventRemindInput.value, 10);
    const remindBefore = Number.isNaN(remindVal) ? 60 : Math.max(0, remindVal);
    const payload = {
        title,
        category,
        ruleType,
        time: this.dom.eventTimeInput.value || '09:00',
        remindBefore,
        workoutId
    };
    if (this.editingEventId) {
        payload.id = this.editingEventId;
    }
    if (ruleType === 'once') {
        payload.date = this.dom.eventDateInput.value || PlannerStore.getLocalDateStr();
    } else if (ruleType === 'weekly') {
        payload.days = this.#getSelectedDays(this.dom.eventDaysGroup);
    } else if (ruleType === 'monthly') {
        payload.dayOfMonth = Math.min(31, Math.max(1, parseInt(this.dom.eventMonthDayInput.value, 10) || 1));
    } else if (ruleType === 'yearly') {
        payload.month = parseInt(this.dom.eventYearMonthSelect.value, 10) || 1;
        payload.day = Math.min(31, Math.max(1, parseInt(this.dom.eventYearDayInput.value, 10) || 1));
        const yr = parseInt(this.dom.eventBirthYearInput.value, 10);
        payload.year = yr > 1900 ? yr : null;
    } else if (ruleType === 'cycle') {
        payload.gap = Math.max(1, parseInt(this.dom.eventCycleGapInput.value, 10) || 2);
        payload.startDate = this.dom.eventCycleStartInput.value || PlannerStore.getLocalDateStr();
        payload.cycleLength = 1;
        payload.cycleIndex = 0;
    }
    PlannerStore.upsertEvent(payload);
    this.#resetEventForm();
    this.renderEvents();
    this.onDataChanged();
  }
    render() {
        this.#renderDayChips();
        this.#renderMonthOptions();
        this.renderWorkoutOptions();
        this.renderAlarms();
        this.renderEvents();
        this.#resetEventForm();
    }
    #renderDayChips() {
        const order = Array.of(1, 2, 3, 4, 5, 6, 0);
        const html = order
        .map((d) => `<button type="button" class="day-chip" data-day="${d}">${I18n.t('wdShort' + d)}</button>`)
        .join('');
        this.dom.alarmDaysGroup.innerHTML = html;
        this.dom.eventDaysGroup.innerHTML = html;
    }
    #renderMonthOptions() {
        let html = '';
        for (let m = 1; m <= 12; m += 1) {
            html += `<option value="${m}">${I18n.t('mon' + m)}</option>`;
        }
        this.dom.eventYearMonthSelect.innerHTML = html;
    }
    renderWorkoutOptions() {
        const workouts = PlannerStore.getWorkouts();
        this.dom.eventWorkoutSelect.innerHTML = workouts
        .map((w) => `<option value="${w.id}">${I18n.t(w.name)}</option>`)
        .join('');
    }
    renderAlarms() {
        const alarms = PlannerStore.getAlarms();
        if (alarms.length === 0) {
            this.dom.alarmsList.innerHTML = `<small style="color:#888">${I18n.t('noAlarmsYet')}</small>`;
            return;
        }
        this.dom.alarmsList.innerHTML = alarms
        .map((a) => {
            const daysLabel = a.days && a.days.length > 0
                ? a.days.map((d) => I18n.t('wdShort' + d)).join(', ')
                : I18n.t('everyDay');
            return  `<div class="list-item"> <div class="list-item-info"> <span><strong style="font-size:1.1rem">${a.time}</strong> — ${a.label || I18n.t('defaultAlarmTitle')}</span> <small>${daysLabel}</small> </div> <div class="item-actions"> <input type="checkbox" ${a.enabled ? 'checked' : ''} data-alarm-toggle="${a.id}"> <button type="button" class="btn btn-danger btn-xs" data-alarm-del="${a.id}">✕</button> </div> </div>`;
        })
        .join('');
    }
    renderEvents() {
        const events = PlannerStore.getEvents();
        if (events.length === 0) {
            this.dom.eventsList.innerHTML = `<small style="color:#888">${I18n.t('noEventsYet')}</small>`;
            return;
        }
        this.dom.eventsList.innerHTML = events
        .map((ev) => {
            let ruleDesc = '';
            if (ev.ruleType === 'once') ruleDesc = ev.date;
            else if (ev.ruleType === 'weekly') ruleDesc = (ev.days || Array.of()).map((d) => I18n.t('wdShort' + d)).join(', ');
            else if (ev.ruleType === 'monthly') ruleDesc = I18n.t('ruleMonthlyDesc', { day: ev.dayOfMonth });
            else if (ev.ruleType === 'yearly') ruleDesc = `${ev.day} ${I18n.t('mon' + ev.month)}`;
            else if (ev.ruleType === 'cycle') ruleDesc = I18n.t('ruleCycleDesc', { gap: ev.gap });
            const remindTxt = ev.remindBefore > 0 ?  `• 🔔 ${ev.remindBefore}m` : '';
            return  `<div class="list-item"> <div class="list-item-info"> <strong>${ev.time} — ${I18n.t(ev.title)}</strong> <small>${ruleDesc}${remindTxt}</small> </div> <div class="item-actions"> <button type="button" class="btn btn-accent btn-xs" data-ev-edit="${ev.id}">✎</button> <button type="button" class="btn btn-danger btn-xs" data-ev-del="${ev.id}">✕</button> </div> </div>`;
        })
        .join('');
    }
    #startClockMonitor() {
        setInterval(() => {
            const now = new Date();
            const dateStr = PlannerStore.getLocalDateStr(now);
            const currMinutes = now.getHours() * 60 + now.getMinutes();
            const items = PlannerStore.getItemsForDate(now);
            items.forEach((item) => {
                const parts = item.time.split(':');
                const targetMinutes = Number(parts.at(0)) * 60 + Number(parts.at(1));
                const exactKey = `${dateStr}_${item.uid}_exact`;
                if (currMinutes === targetMinutes && !this.triggeredKeys.has(exactKey)) {
                    this.triggeredKeys.add(exactKey);
                    this.#triggerRing(item, 0);
                }
                if (item.remindBefore > 0) {
                    const remindMinutes = targetMinutes - item.remindBefore;
                    const remKey = `${dateStr}_${item.uid}_rem_${item.remindBefore}`;
                    if (currMinutes === remindMinutes && !this.triggeredKeys.has(remKey)) {
                        this.triggeredKeys.add(remKey);
                        this.#triggerRing(item, item.remindBefore);
                    }
                }
            });
        }, 10000);
    }
    #triggerRing(item, minutesBefore) {
        this.activeRingingItem = item;
        const soundType = item.raw?.sound || (item.kind === 'alarm' ? 'melody' : PlannerStore.getSettings().soundType);
        const subtitle = minutesBefore > 0
            ? I18n.t('ringingReminderPrefix', { min: minutesBefore })
            : '';
        this.dom.ringingSubtitle.textContent = subtitle;
        this.dom.ringingEventTitle.textContent = `${item.time} — ${item.title}`;
        this.dom.ringingModal.hidden = false;
        this.sound.sendSystemNotification(`${item.time} — ${item.title}`, subtitle || I18n.t('ringingTitle'));
        this.sound.startAlarmLoop(soundType, item.title);
    }
    #exportToICS() {
        const events = PlannerStore.getEvents();
        if (events.length === 0) {
            alert(I18n.t('alertNoEventsCal'));
            return;
        }
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const formatICS = (d) =>
            `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
        const dayMap = Array.of('SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA');
        const blocks = Array.of();
        events.forEach((ev, idx) => {
            const parts = (ev.time || '09:00').split(':');
            const hh = Number(parts.at(0));
            const mm = Number(parts.at(1));
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);
            let rrule = '';
            if (ev.ruleType === 'once' && ev.date) {
                const dParts = ev.date.split('-');
                start.setFullYear(Number(dParts.at(0)), Number(dParts.at(1)) - 1, Number(dParts.at(2)));
            } else if (ev.ruleType === 'weekly' && ev.days?.length) {
                const byDay = ev.days.map((d) => dayMap.at(d)).join(',');
                rrule = `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`;
            } else if (ev.ruleType === 'monthly') {
                start.setDate(Number(ev.dayOfMonth) || 1);
                rrule = `RRULE:FREQ=MONTHLY;BYMONTHDAY=${Number(ev.dayOfMonth) || 1}`;
            } else if (ev.ruleType === 'yearly') {
                start.setMonth((Number(ev.month) || 1) - 1, Number(ev.day) || 1);
                rrule = 'RRULE:FREQ=YEARLY';
            } else if (ev.ruleType === 'cycle') {
                rrule = `RRULE:FREQ=DAILY;INTERVAL=${Math.max(1, Number(ev.gap) || 2)}`;
            }
            const end = new Date(start.getTime() + 30 * 60000);
            const remindMin = ev.remindBefore !== undefined ? Number(ev.remindBefore) : 60;
            blocks.push(
                Array.of(
                    'BEGIN:VEVENT',
                    `UID:lp-${Date.now()}-${idx}@lifeplanner`,
                    `DTSTAMP:${formatICS(now)}`,
                    `DTSTART:${formatICS(start)}`,
                    `DTEND:${formatICS(end)}`,
                    `SUMMARY:${I18n.t(ev.title)}`,
                    rrule,
                    remindMin > 0 ? 'BEGIN:VALARM' : '',
                    remindMin > 0 ? 'ACTION:DISPLAY' : '',
                    remindMin > 0 ? `DESCRIPTION:${I18n.t(ev.title)}` : '',
                    remindMin > 0 ? `TRIGGER:-PT${remindMin}M` : '',
                    remindMin > 0 ? 'END:VALARM' : '',
                    'END:VEVENT'
                ).filter(Boolean).join('\r\n')
            );
        });
        const ics = Array.of('BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LifePlanner//RU', ...blocks, 'END:VCALENDAR').join('\r\n');
        const blob = new Blob(Array.of(ics), { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'life-planner.ics';
        a.click();
        URL.revokeObjectURL(url);
    }
}