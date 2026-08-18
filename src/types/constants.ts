/** プロジェクト名 / タスク名の長さの下限 */
export const NAME_MIN_LENGTH = 1;

/** プロジェクト名 / タスク名の長さの上限 */
export const NAME_MAX_LENGTH = 100;

export const MS_PER_MINUTE = 60_000;

export const MINUTES_PER_HOUR = 60;

/** ID 本体の文字数。32^6 ≈ 10億通り */
export const ID_BODY_LENGTH = 6;

/** Crockford Base32。i, l, o, u を除外し目視での取り違えを防ぐ */
export const ID_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

/** ID 採番のリトライ上限。既存IDとの衝突時に再生成する */
export const ID_MAX_ATTEMPTS = 100;

/** データディレクトリのパーミッション */
export const DIR_MODE = 0o700;

/** データファイルのパーミッション */
export const FILE_MODE = 0o600;

/** プロンプトで切り詰めるタスク名の表示桁数 */
export const PROMPT_TASK_NAME_MAX_WIDTH = 20;

/** 切り詰めたことを示す記号 */
export const ELLIPSIS = '…';

/** 計測中を示すプロンプトのマーカー */
export const MEASURING_MARKER = '▶';

/** プロジェクト未選択時のプロンプト表示 */
export const NO_PROJECT_LABEL = '未選択';

export const PROJECTS_FILE_NAME = 'projects.json';
export const CURRENT_FILE_NAME = 'current.json';
export const RECOVERY_LOG_FILE_NAME = 'recovery.jsonl';
export const ENTRIES_DIR_NAME = 'entries';

/** projects.json の上書き前に残すバックアップの拡張子 */
export const BACKUP_SUFFIX = '.bak';

/** データディレクトリの位置を差し替える環境変数(テストで使用) */
export const TIMELOG_HOME_ENV = 'TIMELOG_HOME';

/** 既定のデータディレクトリ名(ホームディレクトリ配下) */
export const DEFAULT_HOME_DIR_NAME = '.timelog';

/** projects.json のスキーマバージョン */
export const PROJECTS_FILE_VERSION = 1;

/** current.json のスキーマバージョン */
export const CURRENT_FILE_VERSION = 1;
