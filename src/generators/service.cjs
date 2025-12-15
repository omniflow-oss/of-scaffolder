const path = require("path");
const fs = require("fs-extra");
const { baseRepoPrompts, groupIdPrompt, basePackagePromptFor } = require("../scaffolder/prompts.cjs");
const { toJavaPackageSafe } = require("../utils.cjs");

const registerServiceGenerator = ({ plop, ctx, validators, utils }) => {
  plop.setGenerator("service", {
    description: "Create a new Quarkus service under services/<name>",
    prompts: [
      ...baseRepoPrompts({ validateRootPath: validators.validateRootPath }),
      {
        type: "input",
        name: "serviceName",
        message: "Service name (folder/artifactId), e.g. bff, identity, connector-foo:",
        validate: validators.validateArtifactId
      },
      groupIdPrompt({ ctx }),
      {
        type: "input",
        name: "basePackage",
        message: "Base Java package, e.g. com.yourorg.bff:",
        validate: validators.validateJavaPackage,
        default: (a) => `${a.groupId}.${toJavaPackageSafe(a.serviceName)}`
      },
      {
        type: "confirm",
        name: "addWorkflows",
        message: "Also add GitHub Actions workflows (.github/workflows/ci.yml + publish-ghcr.yml)?",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          return ctx.defaultServiceFlags(rootDir).addWorkflows;
        }
      },
      {
        type: "confirm",
        name: "registerInRootPom",
        message: "Register module in root pom.xml <modules>?",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          return ctx.defaultServiceFlags(rootDir).registerInRootPom;
        }
      },
      {
        type: "confirm",
        name: "autowireInternalLibs",
        message: "Autowire internal lib dependencies from libs/* ?",
        default: true
      },
      {
        type: "checkbox",
        name: "internalLibs",
        message: "Internal libs to include as dependencies:",
        when: async (a) => {
          if (!a.autowireInternalLibs) return false;
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          const cfg = ctx.readRepoConfigSync(rootDir);
          const libs = await ctx.listInternalLibs(rootDir, cfg);
          return libs.length > 0;
        },
        choices: async (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          const cfg = ctx.readRepoConfigSync(rootDir);
          const libs = await ctx.listInternalLibs(rootDir, cfg);
          return libs.map((name) => ({ name, value: name }));
        },
        default: async (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          return ctx.defaultServiceFlags(rootDir).internalLibs;
        }
      }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      const rootPomPath = path.join(rootDir, "pom.xml");
      const bomPomPath = path.join(rootDir, "bom", "pom.xml");
      const wfDir = path.join(rootDir, ".github", "workflows");

      return [
        async () => {
          await fs.ensureDir(svcDir);
          if (await fs.pathExists(path.join(svcDir, "pom.xml"))) throw new Error(`Service already exists: ${svcDir}`);

          const cfg = ctx.readRepoConfigSync(rootDir);
          if (!answers.groupId) answers.groupId = cfg.groupId;
          if (!answers.platformArtifactId) answers.platformArtifactId = cfg.platformArtifactId;
          if (!answers.platformVersion) answers.platformVersion = cfg.platformVersion;
          if (!Array.isArray(answers.internalLibs) && answers.autowireInternalLibs !== false) {
            answers.internalLibs = ctx.defaultServiceFlags(rootDir).internalLibs;
          }

          const coords = await utils.readPomCoordinates(rootPomPath);
          if (!answers.groupId) answers.groupId = coords.groupId;
          answers.platformVersion = coords.version || answers.platformVersion || "1.0.0-SNAPSHOT";
          answers.platformArtifactId = coords.artifactId || answers.platformArtifactId || "platform";

          return "OK";
        },
        { type: "add", path: path.join(svcDir, "pom.xml"), templateFile: ctx.template("service", "pom.xml.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/docker/Dockerfile.native"), templateFile: ctx.template("service", "Dockerfile.native.hbs") },
        {
          type: "add",
          path: path.join(svcDir, "src/main/resources/application.properties"),
          templateFile: ctx.template("service", "application.properties.hbs")
        },

        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/api/.gitkeep"), templateFile: ctx.template("service", "gitkeep.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/application/.gitkeep"), templateFile: ctx.template("service", "gitkeep.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/domain/.gitkeep"), templateFile: ctx.template("service", "gitkeep.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/infrastructure/.gitkeep"), templateFile: ctx.template("service", "gitkeep.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/config/.gitkeep"), templateFile: ctx.template("service", "gitkeep.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/shared/.gitkeep"), templateFile: ctx.template("service", "gitkeep.hbs") },

        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/api/ProfileResource.java"), templateFile: ctx.template("service", "ProfileResource.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/api/error/ErrorResponse.java"), templateFile: ctx.template("service", "ErrorResponse.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/api/error/ErrorCode.java"), templateFile: ctx.template("service", "ErrorCode.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/api/error/GlobalExceptionMapper.java"), templateFile: ctx.template("service", "GlobalExceptionMapper.java.hbs") },
        {
          type: "add",
          path: path.join(svcDir, "src/main/java/{{javaPackagePath basePackage}}/infrastructure/logging/RequestContextFilter.java"),
          templateFile: ctx.template("service", "RequestContextFilter.java.hbs")
        },

        { type: "add", path: path.join(svcDir, "src/test/java/{{javaPackagePath basePackage}}/ServiceTest.java"), templateFile: ctx.template("service", "ServiceTest.java.hbs") },
        { type: "add", path: path.join(svcDir, "src/test/java/{{javaPackagePath basePackage}}/ArchitectureTest.java"), templateFile: ctx.template("service", "ArchitectureTest.java.hbs") },
        { type: "add", path: path.join(svcDir, "README.md"), templateFile: ctx.template("_common", "README.md.hbs") },

        async (a) => {
          if (!a.autowireInternalLibs) return "Skipped BOM registration for internal libs";
          if (!Array.isArray(a.internalLibs) || a.internalLibs.length === 0) return "No internal libs to register in BOM";
          if (!(await fs.pathExists(bomPomPath))) return "Skipped BOM registration (no bom/pom.xml)";

          const results = [];
          for (const libName of a.internalLibs) {
            const res = await utils.insertBomDependencyIfMissing({
              bomPomPath,
              groupId: a.groupId,
              artifactId: libName,
              versionExpr: "${project.version}"
            });
            results.push(res);
          }
          if (results.some((r) => r === null)) return "Skipped BOM registration (no dependencyManagement/dependencies)";
          if (results.every((r) => r === false)) return "BOM dependencies already present";
          return "Registered internal libs in BOM (if missing)";
        },
        async (a) => {
          if (!a.registerInRootPom) return "Skipped root pom module registration";
          const modulePath = path.posix.join("services", a.serviceName);
          const res = await utils.insertModuleIfMissing(rootPomPath, modulePath);
          if (res === null) return "Skipped root pom module registration (no <modules>)";
          return res ? `Registered module: ${modulePath}` : `Module already registered: ${modulePath}`;
        },
        async (a) => {
          if (!a.addWorkflows) return "Skipped workflows";
          await fs.ensureDir(wfDir);
          await utils.writeIfAbsent(path.join(wfDir, "ci.yml"), fs.readFileSync(ctx.template("workflows", "ci.yml.hbs"), "utf8"));
          await utils.writeIfAbsent(path.join(wfDir, "publish-ghcr.yml"), fs.readFileSync(ctx.template("workflows", "publish-ghcr.yml.hbs"), "utf8"));
          return "Added workflows (if absent)";
        }
      ];
    }
  });
};

module.exports = { registerServiceGenerator };

