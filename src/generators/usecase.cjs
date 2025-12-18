const path = require("path");
const fs = require("fs-extra");

const registerUseCaseGenerator = ({ plop, ctx, validators, utils }) => {
  plop.setGenerator("usecase", {
    description: "Add a Rev6A usecase skeleton under module/<module>/<usecase>/ inside an existing service",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validators.validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validators.validateArtifactId },
      {
        type: "input",
        name: "rootPackage",
        message: "Root Java package (service), e.g. com.yourcompany.yourapp:",
        validate: validators.validateJavaPackage,
        default: (a) => {
          try {
            const rootDir = path.resolve(process.cwd(), a.rootDir || ".");
            const svcPom = path.join(rootDir, "services", a.serviceName || "", "pom.xml");
            if (fs.pathExistsSync(svcPom)) {
              const xml = fs.readFileSync(svcPom, "utf8");
              const fromPom = xml.match(/<root\.package>\s*([^<\s]+)\s*<\/root\.package>/)?.[1];
              if (fromPom) return fromPom;
            }
            const rootPom = path.join(rootDir, "pom.xml");
            if (fs.pathExistsSync(rootPom)) {
              const xml = fs.readFileSync(rootPom, "utf8");
              const groupId = xml.match(/<groupId>\s*([^<\s]+)\s*<\/groupId>/)?.[1];
              if (groupId && a.serviceName) return `${groupId}.${utils.toJavaPackageSafe(a.serviceName)}`;
            }
            return "";
          } catch {
            return "";
          }
        }
      },
      { type: "input", name: "moduleName", message: "Module name (package), e.g. identity, profile:", validate: validators.validateJavaIdentifier },
      { type: "input", name: "usecaseName", message: "Usecase name (kebab/word), e.g. login, issueotp:", validate: validators.validateJavaIdentifier }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      const svcPomPath = path.join(svcDir, "pom.xml");
      const javaRoot = path.join(svcDir, "src/main/java", utils.javaPackageToPath(answers.rootPackage));
      const testJavaRoot = path.join(svcDir, "src/test/java", utils.javaPackageToPath(answers.rootPackage));
      const rootPomPath = path.join(rootDir, "pom.xml");

      answers.usecasePascal = utils.toPascalCase(answers.usecaseName);
      answers.usecaseKebab = utils.toKebab(answers.usecaseName);
      answers.usecasePackage = `${utils.toJavaPackageSafe(answers.usecaseName)}usecase`;

      const base = path.join(javaRoot, "module", answers.moduleName, answers.usecasePackage);

      const writeTemplateIfAbsent = async (destPath, templatePath) => {
        const content = fs.readFileSync(templatePath, "utf8");
        const rendered = plop.renderString(content, answers);
        return utils.writeIfAbsent(destPath, rendered);
      };

      const ensureDependenciesSection = async () => {
        const xml = await fs.readFile(svcPomPath, "utf8");
        if (xml.includes("<dependencies>") && xml.includes("</dependencies>")) return false;
        const idx = xml.lastIndexOf("</project>");
        if (idx === -1) throw new Error(`Invalid pom.xml (missing </project>): ${svcPomPath}`);
        const insertion = [
          "  <dependencies>",
          "  </dependencies>",
          ""
        ].join("\n");
        await fs.writeFile(svcPomPath, xml.slice(0, idx) + insertion + xml.slice(idx));
        return true;
      };

      const ensureUsecasePomDeps = async () => {
        const cfg = ctx.readRepoConfigSync(rootDir);
        answers.corePackage = cfg?.core?.package;
        if (!answers.corePackage) {
          throw new Error(`Missing core.package in ${path.join(rootDir, ".platform-scaffolder.json")}`);
        }
        const deps = cfg?.defaults?.usecase?.pom?.dependencies;
        const testDeps = cfg?.defaults?.usecase?.pom?.testDependencies;
        if (!Array.isArray(deps) || deps.length === 0) {
          throw new Error(`Missing defaults.usecase.pom.dependencies in ${path.join(rootDir, ".platform-scaffolder.json")}`);
        }
        if (!Array.isArray(testDeps) || testDeps.length === 0) {
          throw new Error(`Missing defaults.usecase.pom.testDependencies in ${path.join(rootDir, ".platform-scaffolder.json")}`);
        }

        await ensureDependenciesSection();

        for (const dep of deps) {
          await utils.insertPomDependencyIfMissing({
            pomPath: svcPomPath,
            groupId: dep.groupId,
            artifactId: dep.artifactId,
            versionExpr: dep.version,
            scope: dep.scope
          });
        }
        for (const dep of testDeps) {
          await utils.insertPomDependencyIfMissing({
            pomPath: svcPomPath,
            groupId: dep.groupId,
            artifactId: dep.artifactId,
            versionExpr: dep.version,
            scope: dep.scope || "test"
          });
        }
      };

      return [
        async () => {
          await fs.ensureDir(svcDir);

          if (!(await fs.pathExists(svcPomPath))) {
            const coords = await utils.readPomCoordinates(rootPomPath);
            if (!coords.groupId || !coords.version) {
              throw new Error(`Could not determine groupId/version from root pom.xml: ${rootPomPath}`);
            }

            const pom = [
              '<project xmlns="http://maven.apache.org/POM/4.0.0">',
              "  <modelVersion>4.0.0</modelVersion>",
              "",
              "  <parent>",
              `    <groupId>${coords.groupId}</groupId>`,
              "    <artifactId>platform-starter</artifactId>",
              `    <version>${coords.version}</version>`,
              "    <relativePath>../../platform-starter/pom.xml</relativePath>",
              "  </parent>",
              "",
              `  <artifactId>${answers.serviceName}</artifactId>`,
              "",
              "  <properties>",
              `    <root.package>${answers.rootPackage}</root.package>`,
              "  </properties>",
              "",
              "  <dependencies>",
              "  </dependencies>",
              "",
              "  <build>",
              "    <plugins>",
              "      <plugin>",
              "        <groupId>io.quarkus</groupId>",
              "        <artifactId>quarkus-maven-plugin</artifactId>",
              "        <executions>",
              "          <execution>",
              "            <goals>",
              "              <goal>build</goal>",
              "              <goal>generate-code</goal>",
              "              <goal>generate-code-tests</goal>",
              "            </goals>",
              "          </execution>",
              "        </executions>",
              "      </plugin>",
              "    </plugins>",
              "  </build>",
              "</project>",
              ""
            ].join("\n");
            await fs.outputFile(svcPomPath, pom);
            await utils.insertModuleIfMissing(rootPomPath, path.posix.join("services", answers.serviceName));
          }
          return "OK";
        },

        async () => ensureUsecasePomDeps().then(() => "Ensured service pom deps"),

        async () => writeTemplateIfAbsent(path.join(javaRoot, "boot/Application.java"), ctx.template("rev6a", "boot", "Application.java.hbs")).then(() => "Bootstrapped boot/Application (if absent)"),
        async () => writeTemplateIfAbsent(path.join(javaRoot, "boot/Wiring.java"), ctx.template("rev6a", "boot", "Wiring.java.hbs")).then(() => "Bootstrapped boot/Wiring (if absent)"),

        async () => writeTemplateIfAbsent(path.join(testJavaRoot, "Rev6AArchitectureTest.java"), ctx.template("rev6a", "test", "Rev6AArchitectureTest.java.hbs")).then(() => "Bootstrapped Rev6AArchitectureTest (if absent)"),

        { type: "add", path: path.join(base, "api/{{usecasePascal}}Resource.java"), templateFile: ctx.template("rev6a", "module", "usecase", "api", "UseCaseResource.java.hbs") },
        { type: "add", path: path.join(base, "api/request/{{usecasePascal}}Request.java"), templateFile: ctx.template("rev6a", "module", "usecase", "api", "request", "UseCaseRequest.java.hbs") },
        { type: "add", path: path.join(base, "api/response/{{usecasePascal}}Response.java"), templateFile: ctx.template("rev6a", "module", "usecase", "api", "response", "UseCaseResponse.java.hbs") },
        { type: "add", path: path.join(base, "application/{{usecasePascal}}Service.java"), templateFile: ctx.template("rev6a", "module", "usecase", "application", "UseCaseService.java.hbs") },
        { type: "add", path: path.join(base, "domain/{{usecasePascal}}Model.java"), templateFile: ctx.template("rev6a", "module", "usecase", "domain", "UseCaseModel.java.hbs") },
        { type: "add", path: path.join(base, "domain/port/{{usecasePascal}}RepositoryPort.java"), templateFile: ctx.template("rev6a", "module", "usecase", "domain", "port", "UseCaseRepositoryPort.java.hbs") },
        { type: "add", path: path.join(base, "domain/error/{{usecasePascal}}ErrorCodes.java"), templateFile: ctx.template("rev6a", "module", "usecase", "domain", "error", "UseCaseErrorCodes.java.hbs") },
        { type: "add", path: path.join(base, "domain/error/{{usecasePascal}}ErrorFactory.java"), templateFile: ctx.template("rev6a", "module", "usecase", "domain", "error", "UseCaseErrorFactory.java.hbs") },
        { type: "add", path: path.join(base, "infrastructure/persistence/{{usecasePascal}}Entity.java"), templateFile: ctx.template("rev6a", "module", "usecase", "infrastructure", "persistence", "UseCaseEntity.java.hbs") },
        { type: "add", path: path.join(base, "infrastructure/persistence/{{usecasePascal}}PersistenceMapper.java"), templateFile: ctx.template("rev6a", "module", "usecase", "infrastructure", "persistence", "UseCasePersistenceMapper.java.hbs") },
        { type: "add", path: path.join(base, "infrastructure/persistence/{{usecasePascal}}RepositoryAdapter.java"), templateFile: ctx.template("rev6a", "module", "usecase", "infrastructure", "persistence", "UseCaseRepositoryAdapter.java.hbs") }
      ];
    }
  });
};

module.exports = { registerUseCaseGenerator };
