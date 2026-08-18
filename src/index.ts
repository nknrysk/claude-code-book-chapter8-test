#!/usr/bin/env node
import { ReadlineIo } from './repl/ReplIo.js';
import { ReplSession } from './repl/ReplSession.js';
import { NameResolver } from './services/NameResolver.js';
import { ProjectService } from './services/ProjectService.js';
import { ReportService } from './services/ReportService.js';
import { TimerService } from './services/TimerService.js';
import { CurrentStore } from './stores/CurrentStore.js';
import { EntryStore } from './stores/EntryStore.js';
import { ProjectStore } from './stores/ProjectStore.js';
import { RecoveryLogStore } from './stores/RecoveryLogStore.js';
import { ensureDataDir } from './stores/ensureDataDir.js';
import { DataCorruptedError } from './types/errors.js';

/**
 * 依存の組み立て(手動 DI)と起動のみを行う。ロジックは持たない。
 * DI コンテナは導入しない。依存の全体像が 1 ファイルで読めることを優先する。
 */
async function main(): Promise<void> {
  await ensureDataDir();

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
  const reportService = new ReportService(
    entryStore,
    new NameResolver(projectService)
  );

  const io = new ReadlineIo();
  const session = new ReplSession({
    projectService,
    timerService,
    reportService,
    io,
  });

  try {
    await session.run();
  } finally {
    io.close();
  }
}

main().catch((error: unknown) => {
  // projects.json の破損は起動を中止する。マスタが読めない状態で登録を続けると、
  // 空のマスタで上書きして既存の ID 体系を失う危険がある
  if (error instanceof DataCorruptedError) {
    process.stderr.write(
      `${error.filePath} が破損しています。\n` +
        'ファイルを修正するか、退避してから再起動してください\n'
    );
    process.exitCode = 1;
    return;
  }

  process.stderr.write(`予期しないエラーが発生しました: ${String(error)}\n`);
  process.exitCode = 1;
});
