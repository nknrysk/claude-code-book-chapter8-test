import type { DateString, IsoDateTime, ProjectId, TaskId } from './ids.js';

/** projects.json のルート。version は将来の移行判定に使う */
export interface ProjectsFile {
  version: 1;
  projects: Project[];
}

export interface Project {
  /** 不変。採番後に変化しない */
  id: ProjectId;
  /** 1-100文字。全プロジェクト内で一意(アーカイブ済みを含む) */
  name: string;
  archived: boolean;
  createdAt: IsoDateTime;
  tasks: Task[];
}

export interface Task {
  /** 不変。採番後に変化しない */
  id: TaskId;
  /** 1-100文字。同一プロジェクト内で一意(アーカイブ済みを含む) */
  name: string;
  archived: boolean;
  createdAt: IsoDateTime;
  /** 最後に計測を開始した日時。「最近使った順」の並び替えキー */
  lastUsedAt: IsoDateTime | null;
}

/**
 * 実績エントリ。参照の正である内部IDと、記録時点の名前スナップショットを併せ持つ。
 * projects.json を失っても履歴が読める状態を保つための二重保持である。
 */
export interface Entry {
  date: DateString;
  start: IsoDateTime;
  end: IsoDateTime;
  /** 作業時間(分)。0以上の整数 */
  minutes: number;
  projectId: ProjectId;
  /** 記録時点のスナップショット */
  projectName: string;
  taskId: TaskId;
  /** 記録時点のスナップショット */
  taskName: string;
  /** 備考。設定された場合のみ存在する */
  note?: string;
  /** 作成経路。KPI「事後修正率」の集計に用いる */
  source: EntrySource;
}

export type EntrySource = 'realtime' | 'manual';

/** 計測中の状態。存在しない = 計測していない */
export interface CurrentTimer {
  version: 1;
  projectId: ProjectId;
  projectName: string;
  taskId: TaskId;
  taskName: string;
  start: IsoDateTime;
  /** note コマンドで設定された備考(上書き) */
  note?: string;
}

/** セッション状態(メモリ上のみ・永続化しない) */
export interface SessionState {
  /** use で切り替えた作業対象 */
  currentProjectId: ProjectId | null;
  /** 直前に show が表示した日付。edit の既定対象(P1) */
  lastShownDate: DateString | null;
}
