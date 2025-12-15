import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import tmp from "tmp";
import nodePlop from "node-plop";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("platform generator bootstraps root + bom + platform-starter", async () => {
  const repoRoot = tmp.dirSync({ unsafeCleanup: true }).name;

  const plop = await nodePlop(path.join(__dirname, "..", "plopfile.cjs"));
  const gen = plop.getGenerator("platform");

  const res = await gen.runActions({
    rootDir: repoRoot,
    groupId: "com.acme",
    platformArtifactId: "platform",
    platformVersion: "1.0.0-SNAPSHOT",
    javaVersion: "21",
    quarkusPlatformVersion: "3.19.1",
    addWorkflows: false
  });

  expect(res.failures).toHaveLength(0);

  await expect(fs.pathExists(path.join(repoRoot, "pom.xml"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(repoRoot, "bom", "pom.xml"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(repoRoot, "platform-starter", "pom.xml"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(repoRoot, ".platform-scaffolder.json"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(repoRoot, "services"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(repoRoot, "libs"))).resolves.toBe(true);

  const rootPom = await fs.readFile(path.join(repoRoot, "pom.xml"), "utf8");
  expect(rootPom).toContain("<module>bom</module>");
  expect(rootPom).toContain("<module>platform-starter</module>");
  expect(rootPom).toContain("<quarkus.platform.version>3.19.1</quarkus.platform.version>");

  const bomPom = await fs.readFile(path.join(repoRoot, "bom", "pom.xml"), "utf8");
  expect(bomPom).toContain("<relativePath>../pom.xml</relativePath>");

  const starterPom = await fs.readFile(path.join(repoRoot, "platform-starter", "pom.xml"), "utf8");
  expect(starterPom).toContain("<artifactId>platform-bom</artifactId>");
});
