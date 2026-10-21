import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "doodle-photo-tests-"));
try {
  const binary = join(scratch, "photo-tests");
  const compiled = spawnSync("xcrun", ["swiftc", "-O", "-o", binary, resolve(root, "modules/doodle-photo/ios/DoodlePhotoProcessor.swift"), resolve(root, "modules/doodle-photo/tests/PhotoPreparationTests.swift")], { stdio: "inherit" });
  process.exitCode = compiled.status ?? 1;
  if (compiled.status === 0) process.exitCode = spawnSync(binary, [], { stdio: "inherit" }).status ?? 1;
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
