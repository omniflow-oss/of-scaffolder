import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import fs from "fs-extra";
import tmp from "tmp";
import nodePlop from "node-plop";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const run = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", ...opts });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });

const it = process.env.RUN_MAVEN_IT === "1" ? test : test.skip;

it("maven clean verify succeeds on generated repo", async () => {

  const repoRoot = tmp.dirSync({ unsafeCleanup: true }).name;
  const mavenRepoLocal = process.env.MAVEN_REPO_LOCAL || ".m2";
  const localRepo = path.isAbsolute(mavenRepoLocal) ? mavenRepoLocal : path.join(repoRoot, mavenRepoLocal);

  const plop = await nodePlop(path.join(__dirname, "..", "plopfile.cjs"));

  await plop.getGenerator("platform").runActions({
    rootDir: repoRoot,
    groupId: "com.acme",
    platformArtifactId: "platform",
    platformVersion: "1.0.0-SNAPSHOT",
    javaVersion: "21",
    quarkusPlatformVersion: "3.19.1",
    addWorkflows: false
  });

  await plop.getGenerator("lib").runActions({
    rootDir: repoRoot,
    libName: "shared-kernel",
    basePackage: "com.acme.sharedkernel",
    registerInRootPom: true,
    registerInBom: true
  });

  const svcDir = path.join(repoRoot, "services", "identity");
  await fs.ensureDir(svcDir);
  await fs.outputFile(
    path.join(svcDir, "pom.xml"),
    `<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.acme</groupId>
    <artifactId>platform-starter</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <relativePath>../../platform-starter/pom.xml</relativePath>
  </parent>
  <artifactId>identity</artifactId>
  <dependencies>
  </dependencies>
</project>
`
  );

  const rootPomPath = path.join(repoRoot, "pom.xml");
  const rootPom = await fs.readFile(rootPomPath, "utf8");
  if (!rootPom.includes("<module>services/identity</module>")) {
    const marker = "<!-- scaffolder:modules:end -->";
    const idx = rootPom.indexOf(marker);
    if (idx === -1) throw new Error("Expected scaffolder modules markers in root pom.xml");
    const updated = rootPom.slice(0, idx) + `  <module>services/identity</module>\n` + rootPom.slice(idx);
    await fs.writeFile(rootPomPath, updated);
  }

  await plop.getGenerator("modules").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    rootPackage: "com.acme.identity",
    moduleName: "profile"
  });

  await plop.getGenerator("usecase").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    rootPackage: "com.acme.identity",
    moduleName: "profile",
    usecaseName: "getprofile"
  });

  await plop.getGenerator("eventbus").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    rootPackage: "com.acme.identity"
  });

  await fs.ensureDir(localRepo);

  await run(
    "mvn",
    ["-B", "-ntp", `-Dmaven.repo.local=${mavenRepoLocal}`, "-DskipTests", "clean", "verify"],
    { cwd: repoRoot, env: { ...process.env, MAVEN_OPTS: process.env.MAVEN_OPTS || "-Duser.timezone=UTC" } }
  );
}, 20 * 60 * 1000);
