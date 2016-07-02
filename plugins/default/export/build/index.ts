/// <reference path="./Love2dBuildSettings.d.ts" />

import Love2dBuildSettingsEditor from "./Love2dBuildSettingsEditor";
import buildLove2d from "./buildLove2d";

SupClient.registerPlugin<SupClient.BuildPlugin>("build", "love2d", {
  settingsEditor: Love2dBuildSettingsEditor,
  build: buildLove2d
});
