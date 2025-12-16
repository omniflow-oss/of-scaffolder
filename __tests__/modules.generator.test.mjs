import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import tmp from "tmp";
import nodePlop from "node-plop";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const addServiceStub = async ({ repoRoot, serviceName, groupId }) => {
  const svcDir = path.join(repoRoot, "services", serviceName);
  await fs.ensureDir(svcDir);
  await fs.outputFile(
    path.join(svcDir, "pom.xml"),
    `<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>${groupId}</groupId>
    <artifactId>platform-starter</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <relativePath>../../platform-starter/pom.xml</relativePath>
  </parent>
  <artifactId>${serviceName}</artifactId>
</project>
`
  );
};

test("modules generator creates module container", async () => {
  const repoRoot = tmp.dirSync({ unsafeCleanup: true }).name;
  const plop = await nodePlop(path.join(__dirname, "..", "plopfile.cjs"));

  await plop.getGenerator("platform").runActions({
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
    addWorkflows: false
  });

  await addServiceStub({ repoRoot, serviceName: "identity", groupId: "com.acme" });

  const res = await plop.getGenerator("modules").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    rootPackage: "com.acme.identity",
    moduleName: "profile"
  });
  expect(res.failures).toHaveLength(0);

  const gitkeep = path.join(repoRoot, "services", "identity", "src/main/java/com/acme/identity/module/profile/.gitkeep");
  await expect(fs.pathExists(gitkeep)).resolves.toBe(true);
});

