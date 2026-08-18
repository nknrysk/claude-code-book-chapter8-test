import type {
  CurrentTimer,
  Entry,
  Project,
  Task,
} from '../../src/types/entities.js';

export const PROJECT_ID = 'p_3x8q1v';
export const TASK_ID = 't_7h2k9m';

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: TASK_ID,
    name: '認証API実装',
    archived: false,
    createdAt: '2026-08-01T09:01:00+09:00',
    lastUsedAt: null,
    ...overrides,
  };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: PROJECT_ID,
    name: 'myproj',
    archived: false,
    createdAt: '2026-08-01T09:00:00+09:00',
    tasks: [makeTask()],
    ...overrides,
  };
}

export function makeCurrentTimer(
  overrides: Partial<CurrentTimer> = {}
): CurrentTimer {
  return {
    version: 1,
    projectId: PROJECT_ID,
    projectName: 'myproj',
    taskId: TASK_ID,
    taskName: '認証API実装',
    start: '2026-08-12T09:12:00+09:00',
    ...overrides,
  };
}

export function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    date: '2026-08-12',
    start: '2026-08-12T09:12:00+09:00',
    end: '2026-08-12T10:17:00+09:00',
    minutes: 65,
    projectId: PROJECT_ID,
    projectName: 'myproj',
    taskId: TASK_ID,
    taskName: '認証API実装',
    source: 'realtime',
    ...overrides,
  };
}
