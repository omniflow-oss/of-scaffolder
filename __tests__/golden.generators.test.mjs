import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import tmp from "tmp";
import nodePlop from "node-plop";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("golden-path generators create files in an existing service", async () => {
  const repoRoot = tmp.dirSync({ unsafeCleanup: true }).name;
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

  await plop.getGenerator("connector").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    groupId: "com.acme",
    basePackage: "com.acme.identity",
    connectorName: "stripe"
  });

  await plop.getGenerator("feature").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    groupId: "com.acme",
    basePackage: "com.acme.identity",
    featureName: "billing"
  });

  await plop.getGenerator("endpoint").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    groupId: "com.acme",
    basePackage: "com.acme.identity",
    endpointName: "tenantsettings"
  });

  await plop.getGenerator("projection").runActions({
    rootDir: repoRoot,
    serviceName: "identity",
    groupId: "com.acme",
    basePackage: "com.acme.identity",
    projectionName: "usage"
  });

  const svcDir = path.join(repoRoot, "services", "identity");
  await expect(
    fs.pathExists(path.join(svcDir, "src/main/java/com/acme/identity/application/connectors/StripeConnector.java"))
  ).resolves.toBe(true);
  await expect(
    fs.pathExists(path.join(svcDir, "src/main/java/com/acme/identity/application/features/Billing/CreateBillingUseCase.java"))
  ).resolves.toBe(true);
  await expect(fs.pathExists(path.join(svcDir, "src/main/java/com/acme/identity/api/TenantsettingsResource.java"))).resolves.toBe(
    true
  );
  await expect(
    fs.pathExists(path.join(svcDir, "src/main/java/com/acme/identity/domain/projections/UsageProjection.java"))
  ).resolves.toBe(true);
});

