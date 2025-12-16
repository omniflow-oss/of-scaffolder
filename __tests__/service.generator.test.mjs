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
  await fs.outputFile(
    path.join(dir, "bom", "pom.xml"),
    `<project>
  <modelVersion>4.0.0</modelVersion>
  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>io.quarkus.platform</groupId>
        <artifactId>quarkus-bom</artifactId>
        <version>3.19.1</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
      <!-- scaffolder:deps:start -->
      <!-- scaffolder:deps:end -->
    </dependencies>
  </dependencyManagement>
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
        internalLibs: ["shared-kernel"],
        dockerBaseImage: "registry.access.redhat.com/ubi9/ubi-minimal:9.5",
        quarkusExtensions: ["quarkus-rest", "quarkus-rest-jackson", "quarkus-hibernate-validator", "quarkus-smallrye-health"],
        testDependencies: [
          { groupId: "io.quarkus", artifactId: "quarkus-junit5", scope: "test" },
          { groupId: "io.rest-assured", artifactId: "rest-assured", scope: "test" },
          { groupId: "com.tngtech.archunit", artifactId: "archunit-junit5", version: "${archunit.version}", scope: "test" }
        ]
      }
    }
  });
  return dir;
};

test("service generator creates full service skeleton", async () => {
  const repoRoot = await createFakeRepo();

  const plop = await nodePlop(path.join(__dirname, "..", "plopfile.cjs"));
  const gen = plop.getGenerator("service");

  const res = await gen.runActions({
    rootDir: repoRoot,
    serviceName: "bff",
    basePackage: "com.acme.bff",
    addWorkflows: false,
    registerInRootPom: true,
    autowireInternalLibs: true
  });

  expect(res.failures).toHaveLength(0);

  const svcDir = path.join(repoRoot, "services", "bff");
  await expect(fs.pathExists(path.join(svcDir, "pom.xml"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(svcDir, "src/main/docker/Dockerfile.native"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(svcDir, "src/test/java/com/acme/bff/ServiceTest.java"))).resolves.toBe(true);

  const pom = await fs.readFile(path.join(svcDir, "pom.xml"), "utf8");
  expect(pom).toContain("<artifactId>bff</artifactId>");
  expect(pom).toContain("<groupId>com.acme</groupId>");
  expect(pom).toContain("<artifactId>platform-starter</artifactId>");
  expect(pom).toContain("<artifactId>shared-kernel</artifactId>");

  const dockerfile = await fs.readFile(path.join(svcDir, "src/main/docker/Dockerfile.native"), "utf8");
  expect(dockerfile).toContain("registry.access.redhat.com/ubi9/ubi-minimal:9.5");
  expect(dockerfile).toContain('ENTRYPOINT ["/work/application"');

  const resource = await fs.readFile(path.join(svcDir, "src/main/java/com/acme/bff/api/ProfileResource.java"), "utf8");
  expect(resource).toContain('Path("/healthz")');
  expect(resource).toContain('"service", "bff"');

  const rootPom = await fs.readFile(path.join(repoRoot, "pom.xml"), "utf8");
  expect(rootPom).toContain("<module>services/bff</module>");

  const bomPom = await fs.readFile(path.join(repoRoot, "bom", "pom.xml"), "utf8");
  expect(bomPom).toContain("<artifactId>shared-kernel</artifactId>");
});
