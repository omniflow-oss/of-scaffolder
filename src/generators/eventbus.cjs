const path = require("path");
const fs = require("fs-extra");

const registerEventBusGenerator = ({ plop, ctx, validators, utils }) => {
  plop.setGenerator("eventbus", {
    description: "Enable EventBus by adding platform-core event contract + in-memory adapter dependency",
    prompts: [
      { type: "input", name: "rootDir", message: "Repo root directory:", default: "../..", validate: validators.validateRootPath },
      { type: "input", name: "serviceName", message: "Existing service name under services/:", validate: validators.validateArtifactId }
    ],
    actions: function (answers) {
      const rootDir = path.resolve(process.cwd(), answers.rootDir);
      const svcDir = path.join(rootDir, "services", answers.serviceName);
      const svcPomPath = path.join(svcDir, "pom.xml");

      const ensureDependenciesSection = async () => {
        const xml = await fs.readFile(svcPomPath, "utf8");
        if (xml.includes("<dependencies>") && xml.includes("</dependencies>")) return false;
        const idx = xml.lastIndexOf("</project>");
        if (idx === -1) throw new Error(`Invalid pom.xml (missing </project>): ${svcPomPath}`);
        const insertion = ["  <dependencies>", "  </dependencies>", ""].join("\n");
        await fs.writeFile(svcPomPath, xml.slice(0, idx) + insertion + xml.slice(idx));
        return true;
      };

      return [
        async () => {
          if (!(await fs.pathExists(svcPomPath))) throw new Error(`Service not found (missing pom.xml): ${svcDir}`);

          const cfg = ctx.readRepoConfigSync(rootDir);
          const groupId = cfg.groupId;
          const artifacts = cfg?.core?.artifacts;
          if (!groupId) throw new Error(`Missing groupId in ${path.join(rootDir, ".platform-scaffolder.json")}`);
          if (!artifacts?.contract || !artifacts?.eventbusInMemory) {
            throw new Error(`Missing core.artifacts.contract/eventbusInMemory in ${path.join(rootDir, ".platform-scaffolder.json")}`);
          }

          await ensureDependenciesSection();
          await utils.insertPomDependencyIfMissing({ pomPath: svcPomPath, groupId, artifactId: artifacts.contract, versionExpr: "${project.version}" });
          await utils.insertPomDependencyIfMissing({ pomPath: svcPomPath, groupId, artifactId: artifacts.eventbusInMemory, versionExpr: "${project.version}" });

          return "Ensured EventBus dependencies";
        }
      ];
    }
  });
};

module.exports = { registerEventBusGenerator };
