const env = process.env;

const defaults = () => ({
  groupId: env.OFCX_GROUP_ID,
  platformArtifactId: env.OFCX_PLATFORM_ARTIFACT_ID || "platform",
  platformVersion: env.OFCX_PLATFORM_VERSION || "1.0.0-SNAPSHOT",
  javaVersion: env.OFCX_JAVA_VERSION || "21",
  mavenMinVersion: env.OFCX_MAVEN_MIN_VERSION || "3.9.0",
  quarkusPlatformGroupId: env.OFCX_QUARKUS_PLATFORM_GROUP_ID || "io.quarkus.platform",
  quarkusPlatformArtifactId: env.OFCX_QUARKUS_PLATFORM_ARTIFACT_ID || "quarkus-bom",
  quarkusPlatformVersion: env.OFCX_QUARKUS_PLATFORM_VERSION || "3.19.1",
  enforcerVersion: env.OFCX_ENFORCER_PLUGIN_VERSION || "3.5.0",
  surefireVersion: env.OFCX_SUREFIRE_PLUGIN_VERSION || "3.5.2",
  spotlessVersion: env.OFCX_SPOTLESS_PLUGIN_VERSION || "2.44.3",
  checkstyleVersion: env.OFCX_CHECKSTYLE_PLUGIN_VERSION || "3.6.0",
  spotbugsVersion: env.OFCX_SPOTBUGS_PLUGIN_VERSION || "4.8.6.6",
  archunitVersion: env.OFCX_ARCHUNIT_VERSION || "1.3.0",
  mandrelBuilderImage:
    env.OFCX_MANDREL_BUILDER_IMAGE ||
    (() => {
      const java = env.OFCX_JAVA_VERSION || "21";
      return `quay.io/quarkus/ubi-quarkus-mandrel-builder-image:23.1-java${java}`;
    })(),
  dockerBaseImage: env.OFCX_DOCKER_BASE_IMAGE || "registry.access.redhat.com/ubi9/ubi-minimal:9.5"
});

module.exports = { defaults };
