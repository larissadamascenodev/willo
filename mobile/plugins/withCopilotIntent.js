/**
 * Adds the iPhone action "Registrar compra no Willo" (plugins/ios/WilloCopilotIntent.swift)
 * to the app target. App Intents have to live in the app itself — the Shortcuts app only
 * finds actions compiled into it — so the file is copied next to the AppDelegate and added
 * to the target's sources at prebuild.
 */
const fs = require("fs");
const path = require("path");
const { IOSConfig, withDangerousMod, withXcodeProject } = require("expo/config-plugins");

const FILE = "WilloCopilotIntent.swift";

module.exports = function withCopilotIntent(config) {
  config = withDangerousMod(config, [
    "ios",
    async (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName);
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(path.join(c.modRequest.projectRoot, "plugins", "ios", FILE), path.join(dir, FILE));
      return c;
    },
  ]);

  config = withXcodeProject(config, (c) => {
    const project = c.modResults;
    const name = c.modRequest.projectName;
    const filepath = `${name}/${FILE}`;
    if (!project.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: name, project });
    }
    return c;
  });

  return config;
};
