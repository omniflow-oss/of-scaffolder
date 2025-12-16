import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import tmp from "tmp";
import nodePlop from "node-plop";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Rev6A golden paths: feature6a + endpoint6a + connector6a + projection6a", async () => {
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
    dockerBaseImage: "registry.access.redhat.com/ubi9/ubi-minimal:9.5",
    addWorkflows: false
  });

  await plop.getGenerator("service6a").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    groupId: "com.acme",
    rootPackage: "com.acme.identity",
    registerInRootPom: true
  });

  await plop.getGenerator("feature6a").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    rootPackage: "com.acme.identity",
    moduleName: "profile"
  });

  await plop.getGenerator("endpoint6a").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    rootPackage: "com.acme.identity",
    moduleName: "profile",
    endpointName: "getprofile"
  });

  await plop.getGenerator("connector6a").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    rootPackage: "com.acme.identity",
    moduleName: "profile",
    usecaseName: "getprofile",
    connectorName: "salesforce"
  });

  await plop.getGenerator("projection6a").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    rootPackage: "com.acme.identity",
    moduleName: "profile",
    usecaseName: "getprofile",
    projectionName: "customer"
  });

  const svcDir = path.join(repoRoot, "services", "identity");
  const base = path.join(
    svcDir,
    "src/main/java/com/acme/identity/module/profile/getprofileusecase"
  );

  await expect(fs.pathExists(path.join(svcDir, "src/main/java/com/acme/identity/module/profile/.gitkeep"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(base, "api/GetprofileResource.java"))).resolves.toBe(true);

  const selectorPath = path.join(base, "infrastructure/strategy/SalesforceClientSelector.java");
  await expect(fs.pathExists(selectorPath)).resolves.toBe(true);
  const selectorTxt = await fs.readFile(selectorPath, "utf8");
  expect(selectorTxt).toContain('defaultValue = "inmemory"');
  expect(selectorTxt).toContain("StrategySelectorSupport");

  await expect(fs.pathExists(path.join(base, "domain/projection/CustomerProjection.java"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(base, "infrastructure/persistence/CustomerProjectionRepositoryAdapter.java"))).resolves.toBe(true);
});

