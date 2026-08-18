import type { Entry } from '../types/entities.js';
import type { ProjectService } from './ProjectService.js';

export interface ResolvedNames {
  /** ID から解決した現在名。解決できない場合はスナップショット名 */
  projectName: string;
  taskName: string;
  /** true の場合、呼び出し側は警告を表示する */
  fromSnapshot: boolean;
}

/**
 * エントリの ID から現在のプロジェクト名 / タスク名を解決し、
 * 失敗時は記録時点のスナップショットへフォールバックする。
 *
 * 解決規則をこの 1 箇所に集約する。show と export(P1) が同じタスクに別の名前を
 * 表示することは、集計ツールとして許容できない。
 */
export class NameResolver {
  constructor(private readonly projectService: ProjectService) {}

  async resolve(entry: Entry): Promise<ResolvedNames> {
    const project = await this.projectService.findProjectById(entry.projectId);
    const task = project?.tasks.find(
      (candidate) => candidate.id === entry.taskId
    );

    if (project === null || task === undefined) {
      return {
        projectName: entry.projectName,
        taskName: entry.taskName,
        fromSnapshot: true,
      };
    }

    return {
      projectName: project.name,
      taskName: task.name,
      fromSnapshot: false,
    };
  }
}
