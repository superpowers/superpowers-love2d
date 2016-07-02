import * as fs from "fs";
import * as async from "async";

interface ServerExportableAsset extends SupCore.Data.Base.Asset {
  serverExport: (folderPath: string, callback: (err: Error, writtenFiles: string[]) => void) => void;
}

SupCore.system.serverBuild = (server: ProjectServer, buildPath: string, callback: (err: string) => void) => {
  fs.mkdirSync(`${buildPath}/files`);

  const assetIdsToExport: string[] = [];
  server.data.entries.walk((entry: SupCore.Data.EntryNode, parent: SupCore.Data.EntryNode) => {
    if (entry.type != null && server.system.data.assetClasses[entry.type].prototype.serverExport != null) assetIdsToExport.push(entry.id);
  });

  let files: string[] = [];

  async.each(assetIdsToExport, (assetId, cb) => {
    server.data.assets.acquire(assetId, null, (err: Error, asset: ServerExportableAsset) => {
      asset.serverExport(`${buildPath}/files`, (err, writtenFiles) => {
        server.data.assets.release(assetId, null);

        files = files.concat(writtenFiles);
        cb();
      });
    });
  }, (err) => {
    if (err != null) { callback("Could not export all assets"); return; }

    const json = JSON.stringify(files, null, 2);
    fs.writeFile(`${buildPath}/files.json`, json, { encoding: "utf8" }, (err) => {
      if (err != null) { callback("Could not save files.json"); return; }

      callback(null);
    });
  });
};
