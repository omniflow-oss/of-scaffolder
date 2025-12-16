const path = require("path");
const fs = require("fs-extra");
const { defaults } = require("../scaffolder/defaults.cjs");

const registerPlatformGenerator = ({ plop, ctx, validators }) => {
  const d = defaults();
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
      { type: "input", name: "groupId", message: "Maven groupId:", default: d.groupId || "" },
      { type: "input", name: "platformArtifactId", message: "Root artifactId (aggregator parent):", default: d.platformArtifactId },
      { type: "input", name: "platformVersion", message: "Platform version:", default: d.platformVersion },
      { type: "input", name: "javaVersion", message: "Java version:", default: d.javaVersion },
      { type: "input", name: "mavenMinVersion", message: "Minimum Maven version:", default: d.mavenMinVersion },
      { type: "input", name: "quarkusPlatformGroupId", message: "Quarkus platform groupId:", default: d.quarkusPlatformGroupId },
      { type: "input", name: "quarkusPlatformArtifactId", message: "Quarkus platform artifactId:", default: d.quarkusPlatformArtifactId },
      { type: "input", name: "quarkusPlatformVersion", message: "Quarkus platform version:", default: d.quarkusPlatformVersion },
      {
        type: "input",
        name: "mandrelBuilderImage",
        message: "Mandrel builder image (Quarkus native container build):",
        default: (a) => d.mandrelBuilderImage.replace(/java\d+$/, `java${a.javaVersion || d.javaVersion}`)
      },
      { type: "input", name: "enforcerVersion", message: "maven-enforcer-plugin version:", default: d.enforcerVersion },
      { type: "input", name: "surefireVersion", message: "maven-surefire-plugin version:", default: d.surefireVersion },
      { type: "input", name: "spotlessVersion", message: "spotless-maven-plugin version:", default: d.spotlessVersion },
      { type: "input", name: "checkstyleVersion", message: "maven-checkstyle-plugin version:", default: d.checkstyleVersion },
      { type: "input", name: "spotbugsVersion", message: "spotbugs-maven-plugin version:", default: d.spotbugsVersion },
      { type: "input", name: "archunitVersion", message: "archunit-junit5 version:", default: d.archunitVersion },
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

          answers.enforcerVersion ||= d.enforcerVersion;
          answers.surefireVersion ||= d.surefireVersion;
          answers.spotlessVersion ||= d.spotlessVersion;
          answers.checkstyleVersion ||= d.checkstyleVersion;
          answers.spotbugsVersion ||= d.spotbugsVersion;
          answers.archunitVersion ||= d.archunitVersion;
          answers.mavenMinVersion ||= d.mavenMinVersion;
          answers.quarkusPlatformGroupId ||= d.quarkusPlatformGroupId;
          answers.quarkusPlatformArtifactId ||= d.quarkusPlatformArtifactId;
          answers.platformVersion ||= d.platformVersion;
          answers.javaVersion ||= d.javaVersion;
          answers.quarkusPlatformVersion ||= d.quarkusPlatformVersion;
          answers.mandrelBuilderImage ||= d.mandrelBuilderImage.replace(/java\d+$/, `java${answers.javaVersion || d.javaVersion}`);

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
