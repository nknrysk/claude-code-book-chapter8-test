import { NameResolver } from '../../src/services/NameResolver.js';
import { ProjectService } from '../../src/services/ProjectService.js';
import { ReportService } from '../../src/services/ReportService.js';
import { TimerService } from '../../src/services/TimerService.js';
import { CurrentStore } from '../../src/stores/CurrentStore.js';
import { EntryStore } from '../../src/stores/EntryStore.js';
import { ProjectStore } from '../../src/stores/ProjectStore.js';
import { RecoveryLogStore } from '../../src/stores/RecoveryLogStore.js';

export interface Services {
  projectService: ProjectService;
  timerService: TimerService;
  reportService: ReportService;
  nameResolver: NameResolver;
  entryStore: EntryStore;
  currentStore: CurrentStore;
  recoveryLogStore: RecoveryLogStore;
}

/** index.ts と同じ結線でサービス一式を組み立てる(統合・E2E テスト用) */
export function buildServices(): Services {
  const projectStore = new ProjectStore();
  const entryStore = new EntryStore();
  const currentStore = new CurrentStore();
  const recoveryLogStore = new RecoveryLogStore();

  const projectService = new ProjectService(projectStore);
  const timerService = new TimerService(
    currentStore,
    entryStore,
    recoveryLogStore,
    projectService
  );
  const nameResolver = new NameResolver(projectService);
  const reportService = new ReportService(entryStore, nameResolver);

  return {
    projectService,
    timerService,
    reportService,
    nameResolver,
    entryStore,
    currentStore,
    recoveryLogStore,
  };
}

/** 「プロジェクト 1 件 + タスク 1 件」を登録した状態を作る */
export async function seedProjectWithTask(
  services: Services,
  options: { projectName?: string; taskName?: string; now?: Date } = {}
): Promise<{ projectId: string; taskId: string }> {
  const now = options.now ?? new Date(2026, 7, 1, 9, 0);
  const project = await services.projectService.addProject(
    options.projectName ?? 'myproj',
    now
  );
  if (!project.ok) throw new Error('プロジェクトの登録に失敗しました');

  const task = await services.projectService.addTask(
    project.value.id,
    options.taskName ?? '認証API実装',
    now
  );
  if (!task.ok) throw new Error('タスクの登録に失敗しました');

  return { projectId: project.value.id, taskId: task.value.id };
}
