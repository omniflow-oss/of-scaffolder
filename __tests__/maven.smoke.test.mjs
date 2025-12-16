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

  await plop.getGenerator("service").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    basePackage: "com.acme.identity",
    addWorkflows: false,
    registerInRootPom: true,
    autowireInternalLibs: true,
    internalLibs: ["shared-kernel"]
  });

  await plop.getGenerator("service6a").runActions({
    rootDir: repoRoot,
    serviceName: "rev6a-identity",
    groupId: "com.acme",
    rootPackage: "com.acme.rev6aidentity",
    registerInRootPom: true
  });

  await plop.getGenerator("usecase6a").runActions({
    rootDir: repoRoot,
    serviceName: "rev6a-identity",
    rootPackage: "com.acme.rev6aidentity",
    moduleName: "profile",
    usecaseName: "getprofile"
  });

  await plop.getGenerator("connector6a").runActions({
    rootDir: repoRoot,
    serviceName: "rev6a-identity",
    rootPackage: "com.acme.rev6aidentity",
    moduleName: "profile",
    usecaseName: "getprofile",
    connectorName: "salesforce"
  });

  await plop.getGenerator("projection6a").runActions({
    rootDir: repoRoot,
    serviceName: "rev6a-identity",
    rootPackage: "com.acme.rev6aidentity",
    moduleName: "profile",
    usecaseName: "getprofile",
    projectionName: "customer"
  });

  await fs.ensureDir(localRepo);

  await run(
    "mvn",
    ["-B", "-ntp", `-Dmaven.repo.local=${mavenRepoLocal}`, "-DskipTests", "clean", "verify"],
    { cwd: repoRoot, env: { ...process.env, MAVEN_OPTS: process.env.MAVEN_OPTS || "-Duser.timezone=UTC" } }
  );
}, 20 * 60 * 1000);
