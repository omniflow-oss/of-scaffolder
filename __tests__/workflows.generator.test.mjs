import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import tmp from "tmp";
import nodePlop from "node-plop";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("platform generator can add workflows (only if absent)", async () => {
  const repoRoot = tmp.dirSync({ unsafeCleanup: true }).name;
  const plop = await nodePlop(path.join(__dirname, "..", "plopfile.cjs"));

  const res = await plop.getGenerator("platform").runActions({
    rootDir: repoRoot,
    groupId: "com.acme",
    platformArtifactId: "platform",
    platformVersion: "1.0.0-SNAPSHOT",
    javaVersion: "21",
    mavenMinVersion: "3.9.0",
    quarkusPlatformGroupId: "io.quarkus.platform",
    quarkusPlatformArtifactId: "quarkus-bom",
    quarkusPlatformVersion: "3.19.1",
    mandrelBuilderImage: "quay.io/quarkus/ubi-quarkus-mandrel-builder-image:23.1-java21",
    enforcerVersion: "3.5.0",
    surefireVersion: "3.5.2",
    spotlessVersion: "2.44.3",
    checkstyleVersion: "3.6.0",
    spotbugsVersion: "4.8.6.6",
    archunitVersion: "1.3.0",
    addWorkflows: true
  });

  expect(res.failures).toHaveLength(0);

  const ci = path.join(repoRoot, ".github/workflows/ci.yml");
  const publish = path.join(repoRoot, ".github/workflows/publish-ghcr.yml");

  await expect(fs.pathExists(ci)).resolves.toBe(true);
  await expect(fs.pathExists(publish)).resolves.toBe(true);

  const ciTxt = await fs.readFile(ci, "utf8");
  expect(ciTxt).toContain("name: ci");
  expect(ciTxt).toContain("pull_request");
  expect(ciTxt).toContain("services_json");
});

