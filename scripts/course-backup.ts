// 교과목 백업·복원 CLI — 관리자 UI와 **같은 로직**(src/lib/backup)을 그대로 쓴다.
//
// 쓰임새
//   1) 지도교수 공유용 실제 백업 파일 만들기
//   2) 라이브 DB에서 backup → 변경 → restore 왕복을 직접 검증하기
//
// 실행 (둘 중 하나의 자격증명이 필요하다 — 값은 셸에서 직접 넣는다):
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."            # 또는
//   $env:PRAGMA_ADMIN_EMAIL="..."; $env:PRAGMA_ADMIN_PASSWORD="..."
//
//   npm run backup:list
//   npm run backup:export -- --outline <id>      (생략하면 가장 최근 교과목)
//   npm run backup:verify -- --outline <id>      (제목을 바꿨다가 복원해 왕복을 확인)
//
// 검증 모드는 교과목 제목 한 칸만 잠시 바꾼 뒤 즉시 복원하며, 시작 전 현재 상태를
// 파일로 남긴다. 삭제는 어느 경로에서도 하지 않는다.

import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  courseBackupFilename,
  parseCourseBackup,
  serializeCourseBackup,
  summarizeCourseBackup,
} from "@/lib/backup/courseBackup";
import {
  fetchCourseBackup,
  listBackupCourses,
  restoreCourseBackup,
  type BackupDbClient,
} from "@/lib/backup/courseBackupApi";

const env = (name: string): string | undefined => process.env[name]?.trim() || undefined;

const requireEnv = (name: string): string => {
  const value = env(name);
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
};

const readArg = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const supabaseUrl = () =>
  env("SUPABASE_URL") ??
  env("VITE_SUPABASE_URL") ??
  `https://${requireEnv("VITE_SUPABASE_PROJECT_ID")}.supabase.co`;

async function connect(): Promise<BackupDbClient> {
  const url = supabaseUrl();
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRoleKey) {
    console.log("· service-role 키로 접속합니다.");
    return createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }) as unknown as BackupDbClient;
  }

  const email = env("PRAGMA_ADMIN_EMAIL");
  const password = env("PRAGMA_ADMIN_PASSWORD");
  const anonKey = env("SUPABASE_ANON_KEY") ?? env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (email && password && anonKey) {
    console.log(`· 관리자 계정(${email})으로 로그인합니다.`);
    const client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`관리자 로그인 실패: ${error.message}`);
    return client as unknown as BackupDbClient;
  }

  throw new Error(
    "자격증명이 없습니다. SUPABASE_SERVICE_ROLE_KEY 또는 PRAGMA_ADMIN_EMAIL·PRAGMA_ADMIN_PASSWORD를 설정해 주세요.",
  );
}

async function resolveOutlineId(db: BackupDbClient): Promise<string> {
  const explicit = readArg("--outline");
  if (explicit) return explicit;
  const courses = await listBackupCourses(db);
  if (courses.length === 0) throw new Error("편성된 교과목이 없습니다.");
  console.log(`· --outline 미지정 → 가장 최근 교과목을 사용합니다: ${courses[0].title}`);
  return courses[0].id;
}

async function commandList(db: BackupDbClient) {
  const courses = await listBackupCourses(db);
  if (courses.length === 0) {
    console.log("편성된 교과목이 없습니다.");
    return;
  }
  console.log(`교과목 ${courses.length}건:`);
  for (const course of courses) {
    console.log(`  ${course.id}  ${course.title}  [${course.level ?? "-"} · ${course.language_direction ?? "-"} · ${course.domain ?? "-"}]`);
  }
}

async function commandExport(db: BackupDbClient) {
  const outlineId = await resolveOutlineId(db);
  const file = await fetchCourseBackup(outlineId, {
    db,
    projectRef: env("VITE_SUPABASE_PROJECT_ID") ?? null,
  });
  const path = readArg("--out") ?? courseBackupFilename(file);
  writeFileSync(path, serializeCourseBackup(file), "utf8");
  const summary = summarizeCourseBackup(file);
  console.log(`백업 완료 → ${path}`);
  console.log(`  교과목: ${summary.title}`);
  console.log(`  주차 ${summary.weekCount}개 · 미션 배정 ${summary.assignmentCount}건 · 학습 미션 ${summary.scenarioCount}건`);
}

async function commandVerify(db: BackupDbClient) {
  const outlineId = await resolveOutlineId(db);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");

  console.log("1) 백업");
  const backup = await fetchCourseBackup(outlineId, { db });
  const backupPath = `pragma-course-backup-검증전-${stamp}.json`;
  writeFileSync(backupPath, serializeCourseBackup(backup), "utf8");
  const before = summarizeCourseBackup(backup);
  console.log(`   ${backupPath} · 주차 ${before.weekCount} · 배정 ${before.assignmentCount} · 미션 ${before.scenarioCount}`);

  console.log("2) 안전한 변경 — 교과목 제목 한 칸");
  const probeTitle = `${before.title} [백업검증 ${stamp}]`;
  const { error: mutateError } = await db
    .from("curriculum_outlines")
    .upsert([{ ...backup.data.curriculum_outlines[0], title: probeTitle }], { onConflict: "id" });
  if (mutateError) throw new Error(`검증용 변경 실패: ${mutateError.message}`);
  const mutated = await fetchCourseBackup(outlineId, { db });
  if (summarizeCourseBackup(mutated).title !== probeTitle) throw new Error("검증용 변경이 반영되지 않았습니다.");
  console.log(`   변경 확인: ${probeTitle}`);

  console.log("3) 파일로 복원");
  const outcome = await restoreCourseBackup(parseCourseBackup(serializeCourseBackup(backup)), { db });

  console.log("4) 원래 값·관계 확인");
  const after = await fetchCourseBackup(outlineId, { db });
  const restored = summarizeCourseBackup(after);
  const checks: Array<[string, boolean]> = [
    ["교과목명 복원", restored.title === before.title],
    ["주차 수 보존", restored.weekCount === before.weekCount],
    ["미션 배정 보존", restored.assignmentCount === before.assignmentCount],
    ["학습 미션 보존", restored.scenarioCount === before.scenarioCount],
    ["기존 미션 덮어쓰지 않음", outcome.scenariosInserted === 0],
  ];
  for (const [label, ok] of checks) console.log(`   ${ok ? "✅" : "❌"} ${label}`);
  if (checks.some(([, ok]) => !ok)) throw new Error("왕복 검증 실패 — 위 항목을 확인하세요.");

  console.log("5) 잘못된 파일 거부 확인");
  try {
    parseCourseBackup('{"hello":"world"}');
    throw new Error("잘못된 파일이 거부되지 않았습니다.");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("manifest")) throw error;
    console.log("   ✅ 형식이 아닌 파일은 사유와 함께 거부됨");
  }

  console.log("\n왕복 검증 통과.");
}

async function main() {
  const command = process.argv[2] ?? "list";
  const db = await connect();
  if (command === "list") return commandList(db);
  if (command === "export") return commandExport(db);
  if (command === "verify") return commandVerify(db);
  throw new Error(`알 수 없는 명령: ${command} (list | export | verify)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
