import { SoundEngine } from './sound.js';
import { TimerController } from './timer.js';
import { WorkoutBuilder } from './builder.js';
import { TodayView } from './today.js';
import { PlannerManager } from './planner.js';
import { PlannerStore } from './store.js';
import { Platform } from './platform.js';
import { I18n } from './i18n.js';
import { DICT } from './dict.js';

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach((content) => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  Platform.init();
  I18n.setDict(DICT);
  I18n.init();

  const sound = new SoundEngine();

  const todayView = new TodayView({
    onRunWorkout: (workout, eventUid) => {
      timer.loadWorkoutPlan(workout, eventUid);
      switchTab('timer');
    },
    onDataChanged: () => {
      planner.renderEvents();
    }
  });

  const timer = new TimerController(sound, {
    onWorkoutFinished: (eventUid) => {
      PlannerStore.toggleCompleted(PlannerStore.getLocalDateStr(), eventUid);
      todayView.render();
    }
  });

  const planner = new PlannerManager(sound, {
    onDataChanged: () => {
      todayView.render();
    }
  });

  const builder = new WorkoutBuilder({
    onRunWorkout: (workout) => {
      timer.loadWorkoutPlan(workout, null);
      switchTab('timer');
    },
    onWorkoutsChanged: () => {
      planner.renderWorkoutOptions();
      planner.renderEvents();
      todayView.render();
    }
  });

  document.getElementById('langToggleBtn')?.addEventListener('click', () => {
    I18n.toggle();
    builder.renderExerciseOptions();
    builder.renderDraftSteps();
    builder.renderSavedWorkouts();
    planner.render();
    todayView.render();
    if (!timer.isRunning && timer.activeEventUid === null) {
      timer.loadFreeMode();
    }
  });

  const updatedFromCloud = await PlannerStore.syncFromCloud();
  if (updatedFromCloud) {
    builder.renderExerciseOptions();
    builder.renderSavedWorkouts();
    planner.render();
    todayView.render();
  }

  document.getElementById('mainTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn) switchTab(btn.dataset.tab);
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
