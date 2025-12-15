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
    </dependencies>
  </dependencyManagement>
</project>
`
  );
  await fs.ensureDir(path.join(dir, "services"));
  await fs.ensureDir(path.join(dir, "libs"));
  await fs.writeJson(path.join(dir, ".platform-scaffolder.json"), { schemaVersion: 1, groupId: "com.acme", platformArtifactId: "platform", platformVersion: "1.0.0-SNAPSHOT" });
  return dir;
};

test("lib generator creates lib skeleton", async () => {
  const repoRoot = await createFakeRepo();

  const plop = await nodePlop(path.join(__dirname, "..", "plopfile.cjs"));
  const gen = plop.getGenerator("lib");

  const res = await gen.runActions({
    rootDir: repoRoot,
    libName: "observability",
    basePackage: "com.acme.observability",
    registerInRootPom: true,
    registerInBom: true
  });

  expect(res.failures).toHaveLength(0);

  const libDir = path.join(repoRoot, "libs", "observability");
  await expect(fs.pathExists(path.join(libDir, "pom.xml"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(libDir, "src/test/java/com/acme/observability/LibTest.java"))).resolves.toBe(true);

  const pom = await fs.readFile(path.join(libDir, "pom.xml"), "utf8");
  expect(pom).toContain("<artifactId>observability</artifactId>");
  expect(pom).toContain("<artifactId>platform-starter</artifactId>");

  const rootPom = await fs.readFile(path.join(repoRoot, "pom.xml"), "utf8");
  expect(rootPom).toContain("<module>libs/observability</module>");

  const bomPom = await fs.readFile(path.join(repoRoot, "bom", "pom.xml"), "utf8");
  expect(bomPom).toContain("<artifactId>observability</artifactId>");
});
