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
    dockerBaseImage: "registry.access.redhat.com/ubi9/ubi-minimal:9.5",
    addWorkflows: false
  });

  await plop.getGenerator("service").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    groupId: "com.acme",
    rootPackage: "com.acme.identity",
    addWorkflows: false,
    registerInRootPom: true,
    autowireInternalLibs: false,
    internalLibs: []
  });

  const res = await plop.getGenerator("eventbus").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    rootPackage: "com.acme.identity"
  });

  expect(res.failures).toHaveLength(0);

  const svcDir = path.join(repoRoot, "services", "identity");
  await expect(fs.pathExists(path.join(svcDir, "src/main/java/com/acme/identity/shared/contract/event/EventEnvelope.java"))).resolves.toBe(true);
  await expect(fs.pathExists(path.join(svcDir, "src/main/java/com/acme/identity/shared/infrastructure/eventbus/inmemory/InMemoryEventBusAdapter.java"))).resolves.toBe(true);
});

