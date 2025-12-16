const path = require("path");
const fs = require("fs-extra");

const registerEventBus6aGenerator = ({ plop, ctx, validators, utils }) => {
  plop.setGenerator("eventbus6a", {
    description: "Add Rev6A in-memory EventBus (shared.contract.event + shared.infrastructure.eventbus.inmemory)",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validators.validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validators.validateArtifactId },
      { type: "input", name: "rootPackage", message: "Root Java package (service), e.g. com.yourcompany.yourapp:", validate: validators.validateJavaPackage }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      const javaRoot = path.join(svcDir, "src/main/java", utils.javaPackageToPath(answers.rootPackage));

      return [
        async () => {
          if (!(await fs.pathExists(path.join(svcDir, "pom.xml")))) throw new Error(`Service not found: ${svcDir}`);
          return "OK";
        },
        { type: "add", path: path.join(javaRoot, "shared/contract/event/EventEnvelope.java"), templateFile: ctx.template("rev6a", "shared", "contract", "event", "EventEnvelope.java.hbs") },
        { type: "add", path: path.join(javaRoot, "shared/contract/event/EventMetadata.java"), templateFile: ctx.template("rev6a", "shared", "contract", "event", "EventMetadata.java.hbs") },
        { type: "add", path: path.join(javaRoot, "shared/contract/event/EventPublisherPort.java"), templateFile: ctx.template("rev6a", "shared", "contract", "event", "EventPublisherPort.java.hbs") },
        { type: "add", path: path.join(javaRoot, "shared/infrastructure/eventbus/inmemory/InMemoryEventBusAdapter.java"), templateFile: ctx.template("rev6a", "shared", "infrastructure", "eventbus", "inmemory", "InMemoryEventBusAdapter.java.hbs") }
      ];
    }
  });
};

module.exports = { registerEventBus6aGenerator };

