import { byRecency } from '../domain/byRecency.js';
import { generateId } from '../domain/generateId.js';
import { resolveTask, type ResolveError } from '../domain/resolveTask.js';
import { formatIsoLocal } from '../formatters/formatIsoLocal.js';
import type { Project, ProjectsFile, Task } from '../types/entities.js';
import type { AppError } from '../types/errors.js';
import type { ProjectId, TaskId } from '../types/ids.js';
import { err, ok, type Result } from '../types/result.js';
import type { ProjectStore } from '../stores/ProjectStore.js';

/**
 * プロジェクト・タスクのマスタ管理。
 *
 * projects.json は起動時に一度読み込んでメモリに保持し、変更時のみ書き戻す。
 * resolveTask は start のたびに呼ばれるため、ここでファイル I/O を発生させない。
 */
export class ProjectService {
  private cache: ProjectsFile | null = null;

  /** 整列済みタスクのキャッシュ。マスタ変更時に破棄する */
  private sortedTasks = new Map<ProjectId, Task[]>();

  constructor(private readonly projectStore: ProjectStore) {}

  /** 起動時にマスタを読み込む。破損している場合は例外が伝播し、起動を中止させる */
  async load(): Promise<void> {
    await this.master();
  }

  async addProject(
    name: string,
    now: Date
  ): Promise<Result<Project, AppError>> {
    const master = await this.master();

    // 一意性はアーカイブ済みを含めて判定する。同名を再登録すると、
    // 過去エントリの表示名が新旧で区別できなくなる
    if (master.projects.some((project) => project.name === name)) {
      return err({ kind: 'DuplicateName', target: 'project', name });
    }

    const project: Project = {
      id: generateId('p', this.collectIds(master)),
      name,
      archived: false,
      createdAt: formatIsoLocal(now),
      tasks: [],
    };
    master.projects.push(project);
    await this.persist(master);
    return ok(project);
  }

  async listProjects(includeArchived: boolean): Promise<Project[]> {
    const master = await this.master();
    return master.projects.filter(
      (project) => includeArchived || !project.archived
    );
  }

  async findProjectById(projectId: ProjectId): Promise<Project | null> {
    const master = await this.master();
    return master.projects.find((project) => project.id === projectId) ?? null;
  }

  async findProjectByName(name: string): Promise<Project | null> {
    const master = await this.master();
    return master.projects.find((project) => project.name === name) ?? null;
  }

  async addTask(
    projectId: ProjectId,
    name: string,
    now: Date
  ): Promise<Result<Task, AppError>> {
    const master = await this.master();
    const project = master.projects.find(
      (candidate) => candidate.id === projectId
    );
    if (project === undefined) {
      return err({
        kind: 'ProjectNotFound',
        input: projectId,
        registered: master.projects.map((candidate) => candidate.name),
      });
    }
    if (project.tasks.some((task) => task.name === name)) {
      return err({ kind: 'DuplicateName', target: 'task', name });
    }

    const task: Task = {
      id: generateId('t', this.collectIds(master)),
      name,
      archived: false,
      createdAt: formatIsoLocal(now),
      lastUsedAt: null,
    };
    project.tasks.push(task);
    await this.persist(master);
    return ok(task);
  }

  /** 最近使った順に整列したタスク。表示連番はこの配列の添字+1 */
  async listTasks(
    projectId: ProjectId,
    includeArchived: boolean
  ): Promise<Task[]> {
    if (includeArchived) {
      const project = await this.findProjectById(projectId);
      return project === null ? [] : [...project.tasks].sort(byRecency);
    }

    const cached = this.sortedTasks.get(projectId);
    if (cached !== undefined) return cached;

    const project = await this.findProjectById(projectId);
    const sorted =
      project === null
        ? []
        : project.tasks.filter((task) => !task.archived).sort(byRecency);
    this.sortedTasks.set(projectId, sorted);
    return sorted;
  }

  /**
   * 番号または名前の部分一致でタスクを解決する。
   * listTasks を唯一の整列点とすることで、task list の表示順と解決順が常に一致する。
   */
  async resolveTask(
    projectId: ProjectId,
    input: string
  ): Promise<Result<Task, ResolveError>> {
    const tasks = await this.listTasks(projectId, false);
    return resolveTask(tasks, input);
  }

  /** start 成功時に呼ばれ、「最近使った順」の並び順を更新する */
  async touchTask(
    projectId: ProjectId,
    taskId: TaskId,
    at: Date
  ): Promise<void> {
    const master = await this.master();
    const task = master.projects
      .find((project) => project.id === projectId)
      ?.tasks.find((candidate) => candidate.id === taskId);
    if (task === undefined) return;

    task.lastUsedAt = formatIsoLocal(at);
    await this.persist(master);
  }

  /** メモリ常駐したマスタを返す。未読み込みなら 1 度だけファイルから読む */
  private async master(): Promise<ProjectsFile> {
    const cached = this.cache;
    if (cached !== null) return cached;

    const loaded = await this.projectStore.load();
    this.cache = loaded;
    this.sortedTasks.clear();
    return loaded;
  }

  private async persist(master: ProjectsFile): Promise<void> {
    await this.projectStore.save(master);
    this.cache = master;
    this.sortedTasks.clear();
  }

  /** ID の衝突判定にはアーカイブ済みを含む全IDを使う(過去エントリの参照が生きているため) */
  private collectIds(master: ProjectsFile): Set<string> {
    const ids = new Set<string>();
    for (const project of master.projects) {
      ids.add(project.id);
      for (const task of project.tasks) ids.add(task.id);
    }
    return ids;
  }
}
