const path = require("path");
const fs = require("fs-extra");

const registerPlatformGenerator = ({ plop, ctx, validators }) => {
  plop.setGenerator("platform", {
    description: "Bootstrap a new platform repo (root + bom + platform-starter + base folders)",
    prompts: [
      {
        type: "input",
        name: "rootDir",
        message: "Target repo root directory to create (absolute or relative):",
        default: ".",
        validate: validators.validateNewRootPath
      },
      { type: "input", name: "groupId", message: "Maven groupId:", default: "com.yourorg" },
      { type: "input", name: "platformArtifactId", message: "Root artifactId (aggregator parent):", default: "platform" },
      { type: "input", name: "platformVersion", message: "Platform version:", default: "1.0.0-SNAPSHOT" },
      { type: "input", name: "javaVersion", message: "Java version:", default: "21" },
      { type: "input", name: "quarkusPlatformVersion", message: "Quarkus platform version:", default: "3.19.1" },
      {
        type: "input",
        name: "mandrelBuilderImage",
        message: "Mandrel builder image (Quarkus native container build):",
        default: (a) => `quay.io/quarkus/ubi-quarkus-mandrel-builder-image:23.1-java${a.javaVersion || "21"}`
      },
      { type: "input", name: "enforcerVersion", message: "maven-enforcer-plugin version:", default: "3.5.0" },
      { type: "input", name: "surefireVersion", message: "maven-surefire-plugin version:", default: "3.5.2" },
      { type: "input", name: "spotlessVersion", message: "spotless-maven-plugin version:", default: "2.44.3" },
      { type: "input", name: "checkstyleVersion", message: "maven-checkstyle-plugin version:", default: "3.6.0" },
      { type: "input", name: "spotbugsVersion", message: "spotbugs-maven-plugin version:", default: "4.8.6.6" },
      { type: "input", name: "archunitVersion", message: "archunit-junit5 version:", default: "1.3.0" },
      {
        type: "confirm",
        name: "addWorkflows",
        message: "Add GitHub Actions workflows (.github/workflows/ci.yml + publish-ghcr.yml)?",
        default: true
      }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const wfDir = path.join(rootDir, ".github", "workflows");

      return [
        async () => {
          await fs.ensureDir(rootDir);
          if (await fs.pathExists(path.join(rootDir, "pom.xml"))) throw new Error(`pom.xml already exists: ${rootDir}`);

          answers.enforcerVersion ||= "3.5.0";
          answers.surefireVersion ||= "3.5.2";
          answers.spotlessVersion ||= "2.44.3";
          answers.checkstyleVersion ||= "3.6.0";
          answers.spotbugsVersion ||= "4.8.6.6";
          answers.archunitVersion ||= "1.3.0";
          answers.mandrelBuilderImage ||= `quay.io/quarkus/ubi-quarkus-mandrel-builder-image:23.1-java${answers.javaVersion || "21"}`;

          return "OK";
        },
        { type: "add", path: path.join(rootDir, "pom.xml"), templateFile: ctx.template("platform", "root.pom.xml.hbs") },
        { type: "add", path: path.join(rootDir, "bom", "pom.xml"), templateFile: ctx.template("platform", "bom.pom.xml.hbs") },
        {
          type: "add",
          path: path.join(rootDir, "platform-starter", "pom.xml"),
          templateFile: ctx.template("platform", "platform-starter.pom.xml.hbs")
        },
        { type: "add", path: path.join(rootDir, ".platform-scaffolder.json"), templateFile: ctx.template("platform", "platform-scaffolder.json.hbs") },
        { type: "add", path: path.join(rootDir, ".gitignore"), templateFile: ctx.template("platform", "gitignore.hbs") },
        {
          type: "add",
          path: path.join(rootDir, "config/checkstyle/checkstyle.xml"),
          templateFile: ctx.template("platform", "checkstyle.xml.hbs")
        },
        {
          type: "add",
          path: path.join(rootDir, "config/spotbugs/exclude.xml"),
          templateFile: ctx.template("platform", "spotbugs-exclude.xml.hbs")
        },
        async (a) => {
          await fs.ensureDir(path.join(rootDir, "services"));
          await fs.ensureDir(path.join(rootDir, "libs"));

          if (!a.addWorkflows) return "Skipped workflows";
          await fs.ensureDir(wfDir);
          await fs.outputFile(path.join(wfDir, "ci.yml"), fs.readFileSync(ctx.template("workflows", "ci.yml.hbs"), "utf8"), { flag: "wx" }).catch(() => {});
          await fs.outputFile(path.join(wfDir, "publish-ghcr.yml"), fs.readFileSync(ctx.template("workflows", "publish-ghcr.yml.hbs"), "utf8"), { flag: "wx" }).catch(() => {});
          return "Added workflows (if absent)";
        }
      ];
    }
  });
};

module.exports = { registerPlatformGenerator };

