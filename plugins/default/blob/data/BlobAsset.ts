import * as mkdirp from "mkdirp";
import * as fs from "fs";
import * as path from "path";

type UploadCallback = SupCore.Data.Base.ErrorCallback & ((err: string, ack: any, mediaType: string, buffer: Buffer) => void);

interface BlobAssetPub {
  mediaType: string;
  buffer: Buffer|ArrayBuffer;
}

export const defaultExtensions: { [mediaType: string]: string; } = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",

  "audio/mp3": "mp3",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/wav": "wav",

  "video/mp4": "mp4",
  "video/ogg": "ogv",

  "application/font-woff": "woff",
  "application/json": "json",
  "application/zip": "zip",

  "application/octet-stream": "dat"
};

export default class BlobAsset extends SupCore.Data.Base.Asset {
  static schema: SupCore.Data.Schema = {
    mediaType: { type: "string" },
    buffer: { type: "buffer" }
  };

  pub: BlobAssetPub;

  constructor(id: string, pub: BlobAssetPub, server: ProjectServer) {
    super(id, pub, BlobAsset.schema, server);
  }

  init(options: any, callback: Function) {
    this.pub = {
      mediaType: null,
      buffer: null
    };

    super.init(options, callback);
  }

  load(assetPath: string) {
    fs.readFile(path.join(assetPath, "blob.json"), { encoding: "utf8" }, (err, pubJSON) => {
      fs.readFile(path.join(assetPath, "blob.dat"), (err, buffer) => {
        let pub: BlobAssetPub = JSON.parse(pubJSON);
        pub.buffer = buffer;
        this._onLoaded(assetPath, pub);
      });
    });
  }

  save(assetPath: string, callback: (err: Error) => any) {
    let buffer = this.pub.buffer;
    delete this.pub.buffer;
    let pubJSON = JSON.stringify(this.pub, null, 2);
    this.pub.buffer = buffer;

    fs.writeFile(path.join(assetPath, "blob.json"), pubJSON, { encoding: "utf8" }, () => {
      if (buffer != null) {
        fs.writeFile(path.join(assetPath, "blob.dat"), buffer, callback);
      } else {
        fs.unlink(path.join(assetPath, "blob.dat"), (err) => {
          if (err != null && err.code !== "ENOENT") { callback(err); return; }
          callback(null);
        });
      }
    });
  }

  serverExport(buildPath: string, callback: (err: Error, writtenFiles: string[]) => void) {
    if (this.pub.buffer == null) { callback (null, []); return; }

    let filePath = this.server.data.entries.getPathFromId(this.id);
    if (filePath.lastIndexOf(".") <= filePath.lastIndexOf("/")) {
      // No dots in the name, try adding a default extension
      filePath += `.${defaultExtensions[this.pub.mediaType]}`;
    }

    const outputPath = `${buildPath}/files/${filePath}`;
    mkdirp(path.dirname(outputPath), () => {
      fs.writeFile(outputPath, this.pub.buffer, (err) => {
        if (err != null) callback(err, null);
        callback(null, [ filePath ]);
      });
    });
  }

  server_upload(client: any, mediaType: string, buffer: Buffer, callback: UploadCallback) {
    if (typeof mediaType !== "string" || mediaType.length === 0) { callback("mediaType must be a string"); return; }
    if (!(buffer instanceof Buffer)) { callback("buffer must be an ArrayBuffer"); return; }

    this.pub.mediaType = mediaType;
    this.pub.buffer = buffer;

    callback(null, null, mediaType, buffer);
    this.emit("change");
  }

  client_upload(mediaType: string, buffer: Buffer) {
    this.pub.mediaType = mediaType;
    this.pub.buffer = buffer;
  }
}
