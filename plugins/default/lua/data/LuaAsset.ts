/// <reference path="../../../common/textEditorWidget/operational-transform.d.ts" />

import * as OT from "operational-transform";
import * as mkdirp from "mkdirp";
import * as path from "path";

import * as dummy_fs from "fs";
// Since we're doing weird things to the fs module,
// the code won't browserify properly with brfs
// so we'll only require them on the server-side
let serverRequire = require;

let fs: typeof dummy_fs;
if ((<any>global).window == null) {
  fs = serverRequire("fs");
}

type EditTextCallback = SupCore.Data.Base.ErrorCallback & ((err: string, ack: any, operationData: OperationData, revisionIndex: number) => void);
type ApplyDraftChangedCallback = SupCore.Data.Base.ErrorCallback;

interface LuaAssetPub {
  text: string;
  draft: string;
  revisionId: number;
}

export default class LuaAsset extends SupCore.Data.Base.Asset {
  static schema: SupCore.Data.Schema = {
    text: { type: "string" },
    draft: { type: "string" },
    revisionId: { type: "integer" }
  };

  pub: LuaAssetPub;
  document: OT.Document;
  hasDraft: boolean;

  constructor(id: string, pub: LuaAssetPub, server: ProjectServer) {
    super(id, pub, LuaAsset.schema, server);
  }

  init(options: any, callback: Function) {
    this.pub = {
      text: "",
      draft: "",
      revisionId: 0
    };

    super.init(options, callback);
  }

  setup() {
    this.document = new OT.Document(this.pub.draft, this.pub.revisionId);
    this.hasDraft = this.pub.text !== this.pub.draft;
  }

  restore() {
    if (this.hasDraft) this.emit("setBadge", "draft", "info");
  }

  load(assetPath: string) {
    let pub: LuaAssetPub;
    fs.readFile(path.join(assetPath, "script.lua"), { encoding: "utf8" }, (err, text) => {
      fs.readFile(path.join(assetPath, "draft.lua"), { encoding: "utf8" }, (err, draft) => {
        pub = { revisionId: 0, text, draft: (draft != null) ? draft : text };

        pub.draft = pub.draft.replace(/\r\n/g, "\n");
        pub.text = pub.text.replace(/\r\n/g, "\n");

        this._onLoaded(assetPath, pub);
      });
    });
  }

  save(assetPath: string, callback: (err: Error) => any) {
    fs.writeFile(path.join(assetPath, "script.lua"), this.pub.text, { encoding: "utf8" }, (err) => {
      if (err != null) { callback(err); return; }

      if (this.hasDraft) {
        fs.writeFile(path.join(assetPath, "draft.lua"), this.pub.draft, { encoding: "utf8" }, callback);
      } else {
        fs.unlink(path.join(assetPath, "draft.lua"), (err) => {
          if (err != null && err.code !== "ENOENT") { callback(err); return; }
          callback(null);
        });
      }
    });
  }

  serverExport(buildPath: string, callback: (err: Error, writtenFiles: string[]) => void) {
    this.export(fs.writeFile, mkdirp, buildPath, this.server.data.entries.getPathFromId(this.id), callback);
  }

  clientExport(buildPath: string, filePath: string, callback: (err: Error, writtenFiles: string[]) => void) {
    this.export(SupApp.writeFile, SupApp.mkdirp, buildPath, filePath, callback);
  }

  private export(writeFile: Function, mkdir: Function, buildPath: string, filePath: string, callback: (err: Error, writtenFiles: string[]) => void) {
    if (filePath.lastIndexOf(".lua") === filePath.length - 4) filePath = filePath.slice(0, -4);
    filePath += ".lua";
    const outputPath = `${buildPath}/${filePath}`;

    const text = this.pub.text;
    mkdir(path.dirname(outputPath), () => {
      writeFile(outputPath, text, (err: Error) => {
        if (err != null) { callback(err, null); return; }
        callback(null, [ filePath ]);
      });
    });
  }

  server_editText(client: any, operationData: OperationData, revisionIndex: number, callback: EditTextCallback) {
    if (operationData.userId !== client.id) { callback("Invalid client id"); return; }

    let operation = new OT.TextOperation();
    if (!operation.deserialize(operationData)) { callback("Invalid operation data"); return; }

    try { operation = this.document.apply(operation, revisionIndex); }
    catch (err) { callback("Operation can't be applied"); return; }

    this.pub.draft = this.document.text;
    this.pub.revisionId++;

    callback(null, null, operation.serialize(), this.document.getRevisionId() - 1);

    if (!this.hasDraft) {
      this.hasDraft = true;
      this.emit("setBadge", "draft", "info");
    }
    this.emit("change");
  }

  client_editText(operationData: OperationData, revisionIndex: number) {
    let operation = new OT.TextOperation();
    operation.deserialize(operationData);
    this.document.apply(operation, revisionIndex);
    this.pub.draft = this.document.text;
    this.pub.revisionId++;
  }

  server_applyDraftChanges(client: any, callback: ApplyDraftChangedCallback) {
    this.pub.text = this.pub.draft;

    callback(null);

    if (this.hasDraft) {
      this.hasDraft = false;
      this.emit("clearBadge", "draft");
    }

    this.emit("change");
  }

  client_applyDraftChanges() { this.pub.text = this.pub.draft; }
}
