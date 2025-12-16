const path = require("path");
const fs = require("fs-extra");

const registerEventBusGenerator = ({ plop, ctx, validators, utils }) => {
  plop.setGenerator("eventbus", {
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

      const writeTemplateIfAbsent = async (destPath, templatePath) => {
        const content = fs.readFileSync(templatePath, "utf8");
        const rendered = plop.renderString(content, answers);
        return utils.writeIfAbsent(destPath, rendered);
      };

      return [
        async () => {
          if (!(await fs.pathExists(path.join(svcDir, "pom.xml")))) throw new Error(`Service not found: ${svcDir}`);
          return "OK";
        },
        async () => {
          const wrote = await writeTemplateIfAbsent(
            path.join(javaRoot, "shared/contract/event/EventEnvelope.java"),
            ctx.template("rev6a", "shared", "contract", "event", "EventEnvelope.java.hbs")
          );
          return wrote ? "Added EventEnvelope" : "EventEnvelope already present";
        },
        async () => {
          const wrote = await writeTemplateIfAbsent(
            path.join(javaRoot, "shared/contract/event/EventMetadata.java"),
            ctx.template("rev6a", "shared", "contract", "event", "EventMetadata.java.hbs")
          );
          return wrote ? "Added EventMetadata" : "EventMetadata already present";
        },
        async () => {
          const wrote = await writeTemplateIfAbsent(
            path.join(javaRoot, "shared/contract/event/EventPublisherPort.java"),
            ctx.template("rev6a", "shared", "contract", "event", "EventPublisherPort.java.hbs")
          );
          return wrote ? "Added EventPublisherPort" : "EventPublisherPort already present";
        },
        async () => {
          const wrote = await writeTemplateIfAbsent(
            path.join(javaRoot, "shared/infrastructure/eventbus/inmemory/InMemoryEventBusAdapter.java"),
            ctx.template("rev6a", "shared", "infrastructure", "eventbus", "inmemory", "InMemoryEventBusAdapter.java.hbs")
          );
          return wrote ? "Added InMemoryEventBusAdapter" : "InMemoryEventBusAdapter already present";
        }
      ];
    }
  });
};

module.exports = { registerEventBusGenerator };
