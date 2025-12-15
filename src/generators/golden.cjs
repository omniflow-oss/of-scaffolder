const path = require("path");
const fs = require("fs-extra");

const servicePathGuard = async ({ rootDir, serviceName }) => {
  const svcDir = path.join(rootDir, "services", serviceName);
  if (!(await fs.pathExists(path.join(svcDir, "pom.xml")))) throw new Error(`Service not found: ${svcDir}`);
  return svcDir;
};

const registerGoldenGenerators = ({ plop, ctx, validators }) => {
  plop.setGenerator("connector", {
    description: "Add a connector extension point inside an existing service",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validators.validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validators.validateArtifactId },
      { type: "input", name: "groupId", message: "Maven groupId:", default: "com.yourorg" },
      { type: "input", name: "basePackage", message: "Base Java package for the service:", validate: validators.validateJavaPackage },
      { type: "input", name: "connectorName", message: "Connector name (kebab or word), e.g. stripe, salesforce:", validate: validators.validateJavaIdentifier }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      return [
        async () => {
          await servicePathGuard({ rootDir, serviceName: answers.serviceName });
          return "OK";
        },
        {
          type: "add",
          path: path.join(
            rootDir,
            "services",
            answers.serviceName,
            "src/main/java/{{javaPackagePath basePackage}}/application/connectors/{{pascal connectorName}}Connector.java"
          ),
          templateFile: ctx.template("golden", "ConnectorPort.java.hbs")
        },
        {
          type: "add",
          path: path.join(
            rootDir,
            "services",
            answers.serviceName,
            "src/main/java/{{javaPackagePath basePackage}}/infrastructure/connectors/{{pascal connectorName}}HttpConnector.java"
          ),
          templateFile: ctx.template("golden", "ConnectorAdapter.java.hbs")
        },
        {
          type: "add",
          path: path.join(rootDir, "services", answers.serviceName, "src/main/java/{{javaPackagePath basePackage}}/config/{{pascal connectorName}}ConnectorConfig.java"),
          templateFile: ctx.template("golden", "ConnectorConfig.java.hbs")
        }
      ];
    }
  });

  plop.setGenerator("feature", {
    description: "Add a feature module (use case + policy + query) inside an existing service",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validators.validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validators.validateArtifactId },
      { type: "input", name: "groupId", message: "Maven groupId:", default: "com.yourorg" },
      { type: "input", name: "basePackage", message: "Base Java package for the service:", validate: validators.validateJavaPackage },
      { type: "input", name: "featureName", message: "Feature name (kebab or word), e.g. billing, onboarding:", validate: validators.validateJavaIdentifier }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      return [
        async () => {
          await servicePathGuard({ rootDir, serviceName: answers.serviceName });
          return "OK";
        },
        {
          type: "add",
          path: path.join(
            rootDir,
            "services",
            answers.serviceName,
            "src/main/java/{{javaPackagePath basePackage}}/application/features/{{pascal featureName}}/Create{{pascal featureName}}UseCase.java"
          ),
          templateFile: ctx.template("golden", "CreateUseCase.java.hbs")
        },
        {
          type: "add",
          path: path.join(
            rootDir,
            "services",
            answers.serviceName,
            "src/main/java/{{javaPackagePath basePackage}}/application/features/{{pascal featureName}}/Get{{pascal featureName}}Query.java"
          ),
          templateFile: ctx.template("golden", "GetQuery.java.hbs")
        },
        {
          type: "add",
          path: path.join(rootDir, "services", answers.serviceName, "src/main/java/{{javaPackagePath basePackage}}/domain/policies/Apply{{pascal featureName}}Policy.java"),
          templateFile: ctx.template("golden", "ApplyPolicy.java.hbs")
        }
      ];
    }
  });

  plop.setGenerator("endpoint", {
    description: "Add a new screen endpoint (resource + DTO + use case) inside an existing service",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validators.validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validators.validateArtifactId },
      { type: "input", name: "groupId", message: "Maven groupId:", default: "com.yourorg" },
      { type: "input", name: "basePackage", message: "Base Java package for the service:", validate: validators.validateJavaPackage },
      { type: "input", name: "endpointName", message: "Endpoint name (kebab or word), e.g. profile, tenant-settings:", validate: validators.validateJavaIdentifier }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      return [
        async () => {
          await servicePathGuard({ rootDir, serviceName: answers.serviceName });
          return "OK";
        },
        {
          type: "add",
          path: path.join(rootDir, "services", answers.serviceName, "src/main/java/{{javaPackagePath basePackage}}/api/{{pascal endpointName}}Resource.java"),
          templateFile: ctx.template("golden", "EndpointResource.java.hbs")
        },
        {
          type: "add",
          path: path.join(rootDir, "services", answers.serviceName, "src/main/java/{{javaPackagePath basePackage}}/api/dto/{{pascal endpointName}}Response.java"),
          templateFile: ctx.template("golden", "EndpointResponse.java.hbs")
        },
        {
          type: "add",
          path: path.join(rootDir, "services", answers.serviceName, "src/main/java/{{javaPackagePath basePackage}}/application/usecases/Get{{pascal endpointName}}UseCase.java"),
          templateFile: ctx.template("golden", "EndpointUseCase.java.hbs")
        }
      ];
    }
  });

  plop.setGenerator("projection", {
    description: "Add a data projection skeleton (domain + repository + adapter) inside an existing service",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validators.validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validators.validateArtifactId },
      { type: "input", name: "groupId", message: "Maven groupId:", default: "com.yourorg" },
      { type: "input", name: "basePackage", message: "Base Java package for the service:", validate: validators.validateJavaPackage },
      { type: "input", name: "projectionName", message: "Projection name (kebab or word), e.g. customer, usage:", validate: validators.validateJavaIdentifier }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      return [
        async () => {
          await servicePathGuard({ rootDir, serviceName: answers.serviceName });
          return "OK";
        },
        {
          type: "add",
          path: path.join(
            rootDir,
            "services",
            answers.serviceName,
            "src/main/java/{{javaPackagePath basePackage}}/domain/projections/{{pascal projectionName}}Projection.java"
          ),
          templateFile: ctx.template("golden", "Projection.java.hbs")
        },
        {
          type: "add",
          path: path.join(
            rootDir,
            "services",
            answers.serviceName,
            "src/main/java/{{javaPackagePath basePackage}}/domain/projections/{{pascal projectionName}}ProjectionRepository.java"
          ),
          templateFile: ctx.template("golden", "ProjectionRepository.java.hbs")
        },
        {
          type: "add",
          path: path.join(
            rootDir,
            "services",
            answers.serviceName,
            "src/main/java/{{javaPackagePath basePackage}}/infrastructure/projections/InMemory{{pascal projectionName}}ProjectionRepository.java"
          ),
          templateFile: ctx.template("golden", "ProjectionAdapter.java.hbs")
        }
      ];
    }
  });
};

module.exports = { registerGoldenGenerators };

