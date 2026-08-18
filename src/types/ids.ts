/** "p_" + Crockford Base32 6文字 (例: "p_3x8q1v") */
export type ProjectId = string;

/** "t_" + Crockford Base32 6文字 (例: "t_7h2k9m") */
export type TaskId = string;

/** ローカル日付 "YYYY-MM-DD" */
export type DateString = string;

/** ローカルタイムゾーンのオフセット付き ISO 8601 (例: "2026-08-12T09:12:00+09:00") */
export type IsoDateTime = string;

/** 月キー "YYYY-MM" */
export type MonthKey = string;
