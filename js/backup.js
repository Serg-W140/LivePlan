import { PlannerStore } from './store.js';
import { I18n } from './i18n.js';

export class BackupManager {
  constructor({ onRestored }) {
    this.onRestored = onRestored;
    this.#bindEvents();
  }

  #bindEvents() {
    const exportBtn = document.getElementById('exportJsonBtn');
    const importBtn = document.getElementById('importJsonBtn');
    const fileInput = document.getElementById('importJsonInput');

    exportBtn?.addEventListener('click', () => this.exportData());

    importBtn?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.item(0);
      if (file) {
        this.importData(file);
        fileInput.value = '';
      }
    });
  }

  exportData() {
    const dump = {
      app: 'LifePlanner',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        exercises: PlannerStore.getExercises(),
        workouts: PlannerStore.getWorkouts(),
        alarms: PlannerStore.getAlarms(),
        events: PlannerStore.getEvents(),
        logs: PlannerStore.getLogs(),
        settings: PlannerStore.getSettings()
      }
    };

    const json = JSON.stringify(dump, null, 2);
    const blob = new Blob(Array.of(json), { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeplanner-backup-${PlannerStore.getLocalDateStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importData(file) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (parsed?.app !== 'LifePlanner' || !parsed?.data) {
        alert(I18n.t('backupInvalidFile'));
        return;
      }

      if (!confirm(I18n.t('backupConfirmRestore'))) return;

      const d = parsed.data;
      if (Array.isArray(d.exercises)) {
        localStorage.setItem(PlannerStore.KEYS.EXERCISES, JSON.stringify(d.exercises));
      }
      if (Array.isArray(d.workouts)) {
        PlannerStore.saveWorkouts(d.workouts);
      }
      if (Array.isArray(d.alarms)) {
        PlannerStore.saveAlarms(d.alarms);
      }
      if (Array.isArray(d.events)) {
        PlannerStore.saveEvents(d.events);
      }
      if (d.logs && typeof d.logs === 'object') {
        localStorage.setItem(PlannerStore.KEYS.LOGS, JSON.stringify(d.logs));
      }
      if (d.settings && typeof d.settings === 'object') {
        PlannerStore.saveSettings(d.settings);
      }

      alert(I18n.t('backupSuccess'));
      if (this.onRestored) this.onRestored();
    } catch (_) {
      alert(I18n.t('backupInvalidFile'));
    }
  }
}
