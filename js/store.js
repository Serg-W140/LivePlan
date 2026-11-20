import { Platform } from './platform.js';
import { I18n } from './i18n.js';

const DEFAULT_EXERCISE_KEYS = Array.of(
  'ex_warmup',
  'ex_pullups',
  'ex_pushups',
  'ex_dips',
  'ex_squats',
  'ex_lunges',
  'ex_plank',
  'ex_crunches',
  'ex_burpees',
  'ex_jumprope',
  'ex_shadowbox',
  'ex_heavybag',
  'ex_cooldown'
);

const DEFAULT_WORKOUTS = Array.of(
  {
    id: 'w_base_1',
    name: 'wk_base',
    steps: Array.of(
      { name: 'ex_warmup', sets: 1, work: 180, rest: 0, afterRest: 30 },
      { name: 'ex_pullups', sets: 4, work: 20, rest: 40, afterRest: 60 },
      { name: 'ex_pushups', sets: 4, work: 30, rest: 30, afterRest: 60 },
      { name: 'ex_plank', sets: 3, work: 45, rest: 30, afterRest: 30 },
      { name: 'ex_cooldown', sets: 1, work: 120, rest: 0, afterRest: 0 }
    )
  },
  {
    id: 'w_box_1',
    name: 'wk_boxing',
    steps: Array.of(
      { name: 'ex_jumprope', sets: 2, work: 120, rest: 30, afterRest: 60 },
      { name: 'ex_shadowbox', sets: 3, work: 180, rest: 60, afterRest: 60 },
      { name: 'ex_burpees', sets: 4, work: 20, rest: 20, afterRest: 40 },
      { name: 'ex_cooldown', sets: 1, work: 120, rest: 0, afterRest: 0 }
    )
  }
);

export class PlannerStore {
  static KEYS = {
    EXERCISES: 'lp_exercises_v1',
    WORKOUTS: 'lp_workouts_v1',
    ALARMS: 'lp_alarms_v1',
    EVENTS: 'lp_events_v1',
    LOGS: 'lp_logs_v1',
    SETTINGS: 'lp_settings_v1'
  };

  static getLocalDateStr(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  static getTomorrowDateStr() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return this.getLocalDateStr(d);
  }

  static #read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  static #write(key, data) {
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
    Platform.saveCloud(key, json);
  }

  // --- НАСТРОЙКИ (по умолчанию напоминание за 60 мин) ---
  static getSettings() {
    return this.#read(this.KEYS.SETTINGS, {
      prepSec: 5,
      soundType: 'gong',
      voiceEnabled: true,
      warnEnabled: true,
      tickEnabled: false,
      defaultRemindBefore: 60
    });
  }

  static saveSettings(patch) {
    const next = { ...this.getSettings(), ...patch };
    this.#write(this.KEYS.SETTINGS, next);
    return next;
  }

  // --- УПРАЖНЕНИЯ И ПРОГРАММЫ ---
  static getExercises() {
    return this.#read(this.KEYS.EXERCISES, DEFAULT_EXERCISE_KEYS);
  }

  static addExercise(nameOrKey) {
    const clean = nameOrKey.trim();
    if (!clean) return;
    const list = this.getExercises();
    if (!list.includes(clean)) {
      list.push(clean);
      this.#write(this.KEYS.EXERCISES, list);
    }
  }

  static getWorkouts() {
    return this.#read(this.KEYS.WORKOUTS, DEFAULT_WORKOUTS);
  }

  static saveWorkouts(list) {
    this.#write(this.KEYS.WORKOUTS, list);
  }

  // --- БУДИЛЬНИКИ ---
  static getAlarms() {
    return this.#read(this.KEYS.ALARMS, Array.of());
  }

  static saveAlarms(list) {
    this.#write(this.KEYS.ALARMS, list);
  }

  static upsertAlarm(alarmObj) {
    const list = this.getAlarms();
    const idx = list.findIndex((a) => a.id === alarmObj.id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...alarmObj };
    } else {
      list.push({
        id: 'alm_' + Date.now(),
        time: '07:30',
        label: '',
        days: Array.of(),
        sound: 'melody',
        enabled: true,
        ...alarmObj
      });
    }
    this.saveAlarms(list);
  }

  // --- СОБЫТИЯ И РАСПИСАНИЕ (с индивидуальным remindBefore) ---
  static getEvents() {
    return this.#read(this.KEYS.EVENTS, Array.of());
  }

  static saveEvents(list) {
    this.#write(this.KEYS.EVENTS, list);
  }

  static upsertEvent(eventObj) {
    const list = this.getEvents();
    const defaultRemind = this.getSettings().defaultRemindBefore ?? 60;
    const idx = list.findIndex((e) => e.id === eventObj.id);

    if (idx !== -1) {
      list[idx] = { ...list[idx], ...eventObj };
    } else {
      list.push({
        id: 'evt_' + Date.now(),
        title: '',
        category: 'event',
        ruleType: 'once',
        time: '09:00',
        remindBefore: defaultRemind,
        workoutId: null,
        ...eventObj
      });
    }
    this.saveEvents(list);
  }

  static removeEvent(id) {
    const filtered = this.getEvents().filter((e) => e.id !== id);
    this.saveEvents(filtered);
  }

  // --- ОТМЕТКИ ВЫПОЛНЕНИЯ ("СДЕЛАНО") ---
  static getLogs() {
    return this.#read(this.KEYS.LOGS, {});
  }

  static isCompleted(dateStr, itemUid) {
    const logs = this.getLogs();
    return Array.isArray(logs[dateStr]) && logs[dateStr].includes(itemUid);
  }

  static toggleCompleted(dateStr, itemUid) {
    const logs = this.getLogs();
    const daySet = new Set(logs[dateStr] || Array.of());
    if (daySet.has(itemUid)) {
      daySet.delete(itemUid);
    } else {
      daySet.add(itemUid);
    }
    logs[dateStr] = Array.from(daySet);
    this.#write(this.KEYS.LOGS, logs);
    return daySet.has(itemUid);
  }

  // --- ПОЛУЧЕНИЕ ПЛАНА НА КОНКРЕТНУЮ ДАТУ ---
  static getItemsForDate(dateObj = new Date()) {
    const dateStr = this.getLocalDateStr(dateObj);
    const dayOfWeek = dateObj.getDay();
    const dayOfMonth = dateObj.getDate();
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();

    const items = Array.of();
    const workouts = this.getWorkouts();
    const defaultRemind = this.getSettings().defaultRemindBefore ?? 60;

    // 1. Будильники
    this.getAlarms().forEach((alarm) => {
      if (!alarm.enabled) return;
      const matchesDay = !alarm.days || alarm.days.length === 0 || alarm.days.includes(dayOfWeek);
      if (matchesDay) {
        items.push({
          uid: `alarm_${alarm.id}`,
          sourceId: alarm.id,
          kind: 'alarm',
          time: alarm.time || '08:00',
          remindBefore: 0,
          title: alarm.label || I18n.t('defaultAlarmTitle'),
          meta: '',
          done: this.isCompleted(dateStr, `alarm_${alarm.id}`),
          raw: alarm
        });
      }
    });

    // 2. События, напоминания, тренировки и дни рождения
    this.getEvents().forEach((ev) => {
      let match = false;
      let extraMeta = '';

      if (ev.ruleType === 'once' && ev.date === dateStr) {
        match = true;
      } else if (ev.ruleType === 'weekly' && Array.isArray(ev.days) && ev.days.includes(dayOfWeek)) {
        match = true;
      } else if (ev.ruleType === 'monthly' && Number(ev.dayOfMonth) === dayOfMonth) {
        match = true;
      } else if (ev.ruleType === 'yearly' && Number(ev.month) === month && Number(ev.day) === dayOfMonth) {
        match = true;
        if (ev.year && Number(ev.year) > 1900) {
          const age = year - Number(ev.year);
          if (age > 0) extraMeta = `🎂 ${age}`;
        }
      } else if (ev.ruleType === 'cycle' && ev.startDate) {
        const start = new Date(`${ev.startDate}T00:00:00`);
        const curr = new Date(`${dateStr}T00:00:00`);
        const diffDays = Math.floor((curr - start) / 86400000);
        const gap = Math.max(1, Number(ev.gap) || 1);
        const len = Math.max(1, Number(ev.cycleLength) || 1);
        if (diffDays >= 0 && diffDays % gap === 0) {
          const idx = (diffDays / gap) % len;
          if (idx === Number(ev.cycleIndex || 0)) match = true;
        }
      }

      if (match) {
        const linkedWorkout = ev.workoutId ? workouts.find((w) => w.id === ev.workoutId) : null;
        const resolvedTitle = ev.title
          ? I18n.t(ev.title)
          : (linkedWorkout ? I18n.t(linkedWorkout.name) : I18n.t('defaultEventTitle'));

        items.push({
          uid: `ev_${ev.id}`,
          sourceId: ev.id,
          kind: ev.category || (linkedWorkout ? 'workout' : 'event'),
          time: ev.time || '09:00',
          remindBefore: ev.remindBefore !== undefined ? Number(ev.remindBefore) : defaultRemind,
          title: resolvedTitle,
          meta: extraMeta,
          workout: linkedWorkout,
          done: this.isCompleted(dateStr, `ev_${ev.id}`),
          raw: ev
        });
      }
    });

    return items.sort((a, b) => a.time.localeCompare(b.time));
  }

  static async syncFromCloud() {
    if (!Platform.isTelegram) return false;
    const keys = Object.values(this.KEYS);
    const cloudData = await Platform.loadCloud(keys);
    if (!cloudData) return false;

    let hasChanges = false;
    keys.forEach((key) => {
      const remoteVal = cloudData[key];
      const localVal = localStorage.getItem(key);
      if (remoteVal && remoteVal !== localVal) {
        localStorage.setItem(key, remoteVal);
        hasChanges = true;
      } else if (!remoteVal && localVal) {
        Platform.saveCloud(key, localVal);
      }
    });
    return hasChanges;
  }
}
