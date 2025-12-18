import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import tmp from "tmp";
import nodePlop from "node-plop";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("eventbus generator adds Rev6A shared event contract + in-memory adapter", async () => {
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
    addWorkflows: false,
    addPlatformCore: true
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

  const res = await plop.getGenerator("eventbus").runActions({
    rootDir: repoRoot,
    serviceName: "identity"
  });

  expect(res.failures).toHaveLength(0);

  const pom = await fs.readFile(path.join(svcDir, "pom.xml"), "utf8");
  expect(pom).toContain("<artifactId>platform-core-contract</artifactId>");
  expect(pom).toContain("<artifactId>platform-core-eventbus-inmemory</artifactId>");
});
