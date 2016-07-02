import * as async from "async";

let projectClient: SupClient.ProjectClient;
const subscribersByAssetId: { [assetId: string]: SupClient.AssetSubscriber } = {};

let entriesSubscriber: SupClient.EntriesSubscriber;
let entries: SupCore.Data.Entries;

let settings: Love2dBuildSettings;

const progress = { index: 0, total: 0, errors: 0 };
const statusElt = document.querySelector(".status");
const progressElt = document.querySelector("progress") as HTMLProgressElement;
const detailsListElt = document.querySelector(".details ol") as HTMLOListElement;

interface ClientExportableAsset extends SupCore.Data.Base.Asset {
  clientExport: (outputPath: string, filePath: string, callback: (err: Error) => void) => void;
}

function loadPlugins(callback: Function) {
  async.each(SupCore.system.pluginsInfo.list, (pluginName, cb) => {
    const pluginPath = `/systems/${SupCore.system.id}/plugins/${pluginName}`;
    SupClient.loadScript(`${pluginPath}/bundles/data.js`, cb);
  }, () => { callback(); });
}

export default function build(socket: SocketIOClient.Socket, theSettings: Love2dBuildSettings) {
  console.log("build");
  settings = theSettings;

  loadPlugins(() => {
    projectClient = new SupClient.ProjectClient(socket);
    entriesSubscriber = { onEntriesReceived };
    projectClient.subEntries(entriesSubscriber);
  });
}

function onEntriesReceived(theEntries: SupCore.Data.Entries) {
  entries = theEntries;
  projectClient.unsubEntries(entriesSubscriber);

  entries.walk((entry) => {
    if (entry.type != null) {
      // Only subscribe to assets that can be exported
      if (SupCore.system.data.assetClasses[entry.type].prototype.clientExport != null) {
        const subscriber = { onAssetReceived };
        subscribersByAssetId[entry.id] = subscriber;

        projectClient.subAsset(entry.id, entry.type, subscriber);
        progress.total++;
      }
    }
  });
}

function updateProgress() {
  progressElt.max = progress.total;
  progressElt.value = progress.index;

  if (progress.index < progress.total) {
    statusElt.textContent = SupClient.i18n.t("builds:love2d.progress", { path: settings.outputFolder, index: progress.index, total: progress.total });
  } else if (progress.errors > 0) {
    statusElt.textContent = SupClient.i18n.t("builds:love2d.doneWithErrors", { path: settings.outputFolder, total: progress.total, errors: progress.errors });
  } else {
    statusElt.textContent = SupClient.i18n.t("builds:love2d.done", { path: settings.outputFolder, total: progress.total });
  }
}

function onAssetReceived(assetId: string, asset: ClientExportableAsset) {
  projectClient.unsubAsset(assetId, subscribersByAssetId[assetId]);
  delete subscribersByAssetId[assetId];

  asset.clientExport(settings.outputFolder, entries.getPathFromId(assetId), (err) => {
    if (err != null) {
      progress.errors++;
      SupClient.html("li", { parent: detailsListElt, textContent: SupClient.i18n.t("builds:love2d.errors.exportFailed", { path: settings.outputFolder }) });
      console.log(err);
    }

    progress.index++;
    updateProgress();
  });
}
