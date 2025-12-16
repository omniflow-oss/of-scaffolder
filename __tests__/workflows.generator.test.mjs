import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import tmp from "tmp";
import nodePlop from "node-plop";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createFakeRepo = async () => {
  const dir = tmp.dirSync({ unsafeCleanup: true }).name;
  await fs.outputFile(
    path.join(dir, "pom.xml"),
    `<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.acme</groupId>
  <artifactId>platform</artifactId>
  <version>1.0.0-SNAPSHOT</version>
  <packaging>pom</packaging>
  <modules>
    <module>bom</module>
    <module>platform-starter</module>
  </modules>
</project>
`
  );
  await fs.ensureDir(path.join(dir, "services"));
  await fs.ensureDir(path.join(dir, "libs"));
  await fs.writeJson(path.join(dir, ".platform-scaffolder.json"), {
    schemaVersion: 1,
    groupId: "com.acme",
    platformArtifactId: "platform",
    platformVersion: "1.0.0-SNAPSHOT",
    defaults: {
      service: {
        dockerBaseImage: "registry.access.redhat.com/ubi9/ubi-minimal:9.5",
        quarkusExtensions: ["quarkus-rest", "quarkus-rest-jackson", "quarkus-hibernate-validator", "quarkus-smallrye-health"],
        testDependencies: [{ groupId: "com.tngtech.archunit", artifactId: "archunit-junit5", version: "${archunit.version}", scope: "test" }]
      }
    }
  });
  return dir;
};

test("service generator can add workflows (only if absent)", async () => {
  const repoRoot = await createFakeRepo();

  const plop = await nodePlop(path.join(__dirname, "..", "plopfile.cjs"));
  const gen = plop.getGenerator("service");

  const res = await gen.runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    groupId: "com.acme",
    rootPackage: "com.acme.identity",
    addWorkflows: true,
    registerInRootPom: false,
    autowireInternalLibs: false
  });

  expect(res.failures).toHaveLength(0);

  const ci = path.join(repoRoot, ".github/workflows/ci.yml");
  const publish = path.join(repoRoot, ".github/workflows/publish-ghcr.yml");

  await expect(fs.pathExists(ci)).resolves.toBe(true);
  await expect(fs.pathExists(publish)).resolves.toBe(true);

  const ciTxt = await fs.readFile(ci, "utf8");
  expect(ciTxt).toContain("name: ci");
  expect(ciTxt).toContain("fetch-depth: 0");
  expect(ciTxt).toContain("pull_request");
  expect(ciTxt).toContain("services_json");

  const publishTxt = await fs.readFile(publish, "utf8");
  expect(publishTxt).toContain("name: publish-ghcr");
});
