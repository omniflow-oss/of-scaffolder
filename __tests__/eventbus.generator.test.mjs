import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import tmp from "tmp";
import nodePlop from "node-plop";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("eventbus generator adds feature-local EventBus skeleton and updates pom/properties", async () => {
  const repoRoot = tmp.dirSync({ unsafeCleanup: true }).name;
  const plop = await nodePlop(path.join(__dirname, "..", "plopfile.cjs"));

  await plop.getGenerator("platform").runActions({
    rootDir: repoRoot,
    groupId: "com.acme",
    platformArtifactId: "platform",
    platformVersion: "1.0.0-SNAPSHOT",
    javaVersion: "21",
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

  await plop.getGenerator("service").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    basePackage: "com.acme.identity",
    addWorkflows: false,
    registerInRootPom: true,
    autowireInternalLibs: false,
    internalLibs: []
  });

  const res = await plop.getGenerator("eventbus").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    groupId: "com.acme",
    basePackage: "com.acme.identity",
    contextName: "user",
    includeKafkaAdapter: true,
    ensureKafkaDependency: true
  });

  expect(res.failures).toHaveLength(0);

  const svcDir = path.join(repoRoot, "services", "identity");
  await expect(
    fs.pathExists(path.join(svcDir, "src/main/java/com/acme/identity/shared/strategy/StrategyRegistry.java"))
  ).resolves.toBe(true);
  await expect(
    fs.pathExists(path.join(svcDir, "src/main/java/com/acme/identity/user/application/port/EventBus.java"))
  ).resolves.toBe(true);
  await expect(
    fs.pathExists(path.join(svcDir, "src/main/java/com/acme/identity/user/infrastructure/adapter/event/kafka/KafkaEventBusAdapter.java"))
  ).resolves.toBe(true);

  const pom = await fs.readFile(path.join(svcDir, "pom.xml"), "utf8");
  expect(pom).toContain("quarkus-smallrye-reactive-messaging-kafka");

  const props = await fs.readFile(path.join(svcDir, "src/main/resources/application.properties"), "utf8");
  expect(props).toContain("user.eventbus.adapter=kafka");
  expect(props).toContain("mp.messaging.outgoing.user-events.connector=smallrye-kafka");
  expect(props).toContain("mp.messaging.outgoing.user-events.topic=user.events");
});

