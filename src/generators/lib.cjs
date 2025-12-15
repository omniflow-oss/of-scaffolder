const path = require("path");
const fs = require("fs-extra");
const { baseRepoPrompts, groupIdPrompt, basePackagePromptFor } = require("../scaffolder/prompts.cjs");

const registerLibGenerator = ({ plop, ctx, validators, utils }) => {
  plop.setGenerator("lib", {
    description: "Create a new internal lib under libs/<name>",
    prompts: [
      ...baseRepoPrompts({ validateRootPath: validators.validateRootPath }),
      {
        type: "input",
        name: "libName",
        message: "Lib name (folder/artifactId), e.g. shared-kernel, observability:",
        validate: validators.validateArtifactId
      },
      groupIdPrompt({ ctx }),
      basePackagePromptFor({ validateJavaPackage: validators.validateJavaPackage, nameKey: "libName" }),
      {
        type: "confirm",
        name: "registerInRootPom",
        message: "Register module in root pom.xml <modules>?",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          return ctx.defaultLibFlags(rootDir).registerInRootPom;
        }
      },
      {
        type: "confirm",
        name: "registerInBom",
        message: "Register dependency in bom/pom.xml <dependencyManagement>?",
        default: (a) => {
          const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
          return ctx.defaultLibFlags(rootDir).registerInBom;
        }
      }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const libDir = path.join(rootDir, "libs", answers.libName);
      const rootPomPath = path.join(rootDir, "pom.xml");
      const bomPomPath = path.join(rootDir, "bom", "pom.xml");

      return [
        async () => {
          await fs.ensureDir(libDir);
          if (await fs.pathExists(path.join(libDir, "pom.xml"))) throw new Error(`Lib already exists: ${libDir}`);

          const cfg = ctx.readRepoConfigSync(rootDir);
          if (!answers.groupId) answers.groupId = cfg.groupId;
          if (!answers.platformArtifactId) answers.platformArtifactId = cfg.platformArtifactId;
          if (!answers.platformVersion) answers.platformVersion = cfg.platformVersion;

          const coords = await utils.readPomCoordinates(rootPomPath);
          if (!answers.groupId) answers.groupId = coords.groupId;
          answers.platformVersion = coords.version || answers.platformVersion || "1.0.0-SNAPSHOT";
          answers.platformArtifactId = coords.artifactId || answers.platformArtifactId || "platform";
          return "OK";
        },
        { type: "add", path: path.join(libDir, "pom.xml"), templateFile: ctx.template("lib", "pom.xml.hbs") },
        { type: "add", path: path.join(libDir, "README.md"), templateFile: ctx.template("lib", "README.md.hbs") },
        { type: "add", path: path.join(libDir, "src/main/java/{{javaPackagePath basePackage}}/.gitkeep"), templateFile: ctx.template("lib", "gitkeep.hbs") },
        { type: "add", path: path.join(libDir, "src/test/java/{{javaPackagePath basePackage}}/LibTest.java"), templateFile: ctx.template("lib", "LibTest.java.hbs") },
        async (a) => {
          if (a.registerInRootPom) {
            const modulePath = path.posix.join("libs", a.libName);
            const res = await utils.insertModuleIfMissing(rootPomPath, modulePath);
            if (res === null) return "Skipped root pom module registration (no <modules>)";
            return res ? `Registered module: ${modulePath}` : `Module already registered: ${modulePath}`;
          }
          return "Skipped root pom module registration";
        },
        async (a) => {
          if (!a.registerInBom) return "Skipped BOM registration";
          if (!(await fs.pathExists(bomPomPath))) return "Skipped BOM registration (no bom/pom.xml)";
          const res = await utils.insertBomDependencyIfMissing({
            bomPomPath,
            groupId: a.groupId,
            artifactId: a.libName,
            versionExpr: "${project.version}"
          });
          if (res === null) return "Skipped BOM registration (no dependencyManagement/dependencies)";
          return res ? `Registered BOM dependency: ${a.libName}` : `BOM dependency already present: ${a.libName}`;
        }
      ];
    }
  });
};

module.exports = { registerLibGenerator };

