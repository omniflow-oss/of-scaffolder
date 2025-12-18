import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import tmp from "tmp";
import nodePlop from "node-plop";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const addServiceStub = async ({ repoRoot, serviceName, groupId, rootPackage }) => {
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
  <properties>
    <root.package>${rootPackage}</root.package>
  </properties>
  <dependencies>
  </dependencies>
</project>
`
  );
  return svcDir;
};

test("usecase generator bootstraps Rev6A service + creates usecase skeleton", async () => {
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

  await addServiceStub({ repoRoot, serviceName: "identity", groupId: "com.acme", rootPackage: "com.acme.identity" });

  const res = await plop.getGenerator("usecase").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    rootPackage: "com.acme.identity",
    moduleName: "profile",
    usecaseName: "getprofile"
  });
  expect(res.failures).toHaveLength(0);

  const svcRoot = path.join(repoRoot, "services", "identity");
  await expect(fs.pathExists(path.join(svcRoot, "src/main/java/com/acme/identity/boot/Application.java"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(repoRoot, "libs/platform-core-contract/pom.xml"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(repoRoot, "libs/platform-core-infrastructure/pom.xml"))).resolves.toBe(true);

  const base = path.join(svcRoot, "src/main/java/com/acme/identity/module/profile/getprofileusecase");
  await expect(fs.pathExists(path.join(base, "api/GetprofileResource.java"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(base, "domain/error/GetprofileErrorCodes.java"))).resolves.toBe(true);

  const pom = await fs.readFile(path.join(svcRoot, "pom.xml"), "utf8");
  expect(pom).toContain("<artifactId>quarkus-rest</artifactId>");
  expect(pom).toContain("<artifactId>platform-core-contract</artifactId>");
  expect(pom).toContain("<artifactId>platform-core-infrastructure</artifactId>");
  expect(pom).toContain("<artifactId>archunit-junit5</artifactId>");
});
