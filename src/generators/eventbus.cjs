const path = require("path");
const fs = require("fs-extra");

const registerEventBusGenerator = ({ plop, ctx, validators, utils }) => {
  plop.setGenerator("eventbus", {
    description: "Add a feature-local EventBus port + adapters (memory/kafka) + gateway + config",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validators.validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validators.validateArtifactId },
      {
        type: "input",
        name: "groupId",
        message: "Maven groupId:",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          return ctx.defaultGroupId(rootDir);
        }
      },
      {
        type: "input",
        name: "basePackage",
        message: "Base Java package for the service:",
        validate: validators.validateJavaPackage,
        default: (a) => `${a.groupId}.${utils.toJavaPackageSafe(a.serviceName)}`
      },
      {
        type: "input",
        name: "contextName",
        message: "Feature/context name (used for config + topic), e.g. user, billing:",
        validate: validators.validateJavaIdentifier
      },
      {
        type: "confirm",
        name: "includeKafkaAdapter",
        message: "Also generate Kafka adapter + reactive-messaging config?",
        default: false
      },
      {
        type: "confirm",
        name: "ensureKafkaDependency",
        message: "Ensure Quarkus Kafka reactive-messaging dependency in service pom.xml?",
        default: true,
        when: (a) => Boolean(a.includeKafkaAdapter)
      }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      const pomPath = path.join(svcDir, "pom.xml");
      const propsPath = path.join(svcDir, "src/main/resources/application.properties");

      const featureBasePackage = `${answers.basePackage}.${utils.toJavaPackageSafe(answers.contextName)}`;

      answers.featureBasePackage = featureBasePackage;
      answers.configKey = `${utils.toKebab(answers.contextName)}.eventbus.adapter`;
      answers.channelName = `${utils.toKebab(answers.contextName)}-events`;
      answers.topicName = `${utils.toKebab(answers.contextName)}.events`;

      return [
        async () => {
          if (!(await fs.pathExists(pomPath))) throw new Error(`Service not found: ${svcDir}`);
          return "OK";
        },
        async () => {
          const strategyDir = path.join(svcDir, "src/main/java", utils.javaPackageToPath(answers.basePackage), "shared/strategy");
          await fs.ensureDir(strategyDir);

          await utils.writeIfAbsent(
            path.join(strategyDir, "NamedStrategy.java"),
            plop.renderString(fs.readFileSync(ctx.template("eventbus", "NamedStrategy.java.hbs"), "utf8"), answers)
          );
          await utils.writeIfAbsent(
            path.join(strategyDir, "StrategyRegistry.java"),
            plop.renderString(fs.readFileSync(ctx.template("eventbus", "StrategyRegistry.java.hbs"), "utf8"), answers)
          );
          await utils.writeIfAbsent(
            path.join(strategyDir, "CdiStrategyRegistry.java"),
            plop.renderString(fs.readFileSync(ctx.template("eventbus", "CdiStrategyRegistry.java.hbs"), "utf8"), answers)
          );
          return "Added strategy helpers (if absent)";
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath featureBasePackage}}/application/port/EventBus.java"),
          templateFile: ctx.template("eventbus", "EventBus.java.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath featureBasePackage}}/application/service/EventBusGateway.java"),
          templateFile: ctx.template("eventbus", "EventBusGateway.java.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath featureBasePackage}}/infrastructure/adapter/event/memory/DefaultEventBusAdapter.java"),
          templateFile: ctx.template("eventbus", "DefaultEventBusAdapter.java.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath featureBasePackage}}/domain/event/{{pascal contextName}}CreatedEvent.java"),
          templateFile: ctx.template("eventbus", "ExampleDomainEvent.java.hbs")
        },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath featureBasePackage}}/config/{{pascal contextName}}ConfigurationKeys.java"),
          templateFile: ctx.template("eventbus", "ConfigurationKeys.java.hbs")
        },
        async (a) => {
          const lines = [];
          lines.push(`${a.configKey}=${a.includeKafkaAdapter ? "kafka" : "default"}`);
          if (a.includeKafkaAdapter) {
            lines.push(`mp.messaging.outgoing.${a.channelName}.connector=smallrye-kafka`);
            lines.push(`mp.messaging.outgoing.${a.channelName}.topic=${a.topicName}`);
          }
          await utils.appendPropertiesIfMissing({
            propertiesPath: propsPath,
            marker: `eventbus:${a.contextName}`,
            lines
          });
          return "Updated application.properties (if missing)";
        },
        async (a) => {
          if (!a.includeKafkaAdapter) return "Skipped Kafka adapter";
          await fs.ensureDir(path.join(svcDir, "src/main/java", utils.javaPackageToPath(a.featureBasePackage), "infrastructure/adapter/event/kafka"));
          await fs.outputFile(
            path.join(
              svcDir,
              "src/main/java",
              utils.javaPackageToPath(a.featureBasePackage),
              "infrastructure/adapter/event/kafka/KafkaEventBusAdapter.java"
            ),
            plop.renderString(fs.readFileSync(ctx.template("eventbus", "KafkaEventBusAdapter.java.hbs"), "utf8"), a),
            { flag: "wx" }
          ).catch(() => {});
          return "Added Kafka adapter (if absent)";
        },
        async (a) => {
          if (!a.includeKafkaAdapter || !a.ensureKafkaDependency) return "Skipped Kafka dependency";
          const res = await utils.insertPomDependencyIfMissing({
            pomPath,
            groupId: "io.quarkus",
            artifactId: "quarkus-smallrye-reactive-messaging-kafka",
            markerStart: "<!-- scaffolder:quarkus-ext:start -->",
            markerEnd: "<!-- scaffolder:quarkus-ext:end -->"
          });
          if (res === null) return "Skipped pom dependency insert (no <dependencies>)";
          return res ? "Added quarkus-smallrye-reactive-messaging-kafka dependency" : "Kafka dependency already present";
        }
      ];
    }
  });
};

module.exports = { registerEventBusGenerator };

