import BlobAsset, { defaultExtensions } from "../../data/BlobAsset";

/* tslint:disable */
let PerfectResize = require("perfect-resize");
/* tslint:enable */

// Setup resizable panes
new PerfectResize(document.querySelector(".sidebar"), "right");

let socket: SocketIOClient.Socket;
let projectClient: SupClient.ProjectClient;
let asset: BlobAsset;
let outputFilename: string;

SupClient.i18n.load([{ root: `${window.location.pathname}/../..`, name: "blobEditor" }], () => {
  SupClient.setupHotkeys();

  socket = SupClient.connect(SupClient.query.project);
  socket.on("welcome", onWelcome);
  socket.on("disconnect", SupClient.onDisconnected);

  // Upload
  let fileSelect = <HTMLInputElement>document.querySelector("input.file-select");
  fileSelect.addEventListener("change", onFileSelectChange);
  document.querySelector("button.upload").addEventListener("click", () => { fileSelect.click(); } );
  document.querySelector("button.download").addEventListener("click", onDownloadBlob);
});

function onWelcome() {
  projectClient = new SupClient.ProjectClient(socket);

  let subscriber: SupClient.AssetSubscriber = {
    onAssetReceived, onAssetEdited,
    onAssetTrashed: SupClient.onAssetTrashed
  };

  projectClient.subAsset(SupClient.query.asset, "blob", subscriber);

  let entriesSubscriber: SupClient.EntriesSubscriber = {
    onEntriesReceived: () => { setupMediaInfo(); },
    onEntryAdded: () => { /* Ignore */ },
    onEntryMoved: () => { /* Ignore */ },
    onEntryTrashed: () => { /* Ignore */ },
    onSetEntryProperty: (id: string, key: string) => { if (id === SupClient.query.asset && key === "name") setupMediaInfo(); }
  };
  projectClient.subEntries(entriesSubscriber);
}

function onAssetReceived(assetId: string, theAsset: BlobAsset) {
  asset = theAsset;

  (document.querySelector("button.upload") as HTMLButtonElement).disabled = false;
  (document.querySelector("button.download") as HTMLButtonElement).disabled = false;
  setupPreview();
  setupMediaInfo();
}

let previewObjectURL: string;

function setupPreview() {
  if (previewObjectURL != null) {
    URL.revokeObjectURL(previewObjectURL);
    previewObjectURL = null;
  }

  let mainElt = document.querySelector(".main") as HTMLDivElement;
  mainElt.innerHTML = "";

  let previewType = (asset.pub.mediaType != null) ? asset.pub.mediaType.split("/")[0] : null;
  let typedArray = new Uint8Array(asset.pub.buffer as ArrayBuffer);
  let blob = new Blob([ typedArray ], { type: asset.pub.mediaType });
  previewObjectURL = URL.createObjectURL(blob);

  switch (previewType) {
    case "image":
    case "video":
    case "audio":
      let playerElt: HTMLImageElement|HTMLVideoElement|HTMLAudioElement;
      if (previewType === "image") playerElt = new Image();
      else {
        playerElt = document.createElement(previewType) as HTMLAudioElement|HTMLVideoElement;
        (playerElt as HTMLAudioElement|HTMLVideoElement).controls = true;
      }

      playerElt.src = previewObjectURL;
      mainElt.appendChild(playerElt);
      break;

    default:
      let noPreviewElt = document.createElement("div");
      noPreviewElt.classList.add("no-preview");
      mainElt.appendChild(noPreviewElt);

      if (previewType != null) noPreviewElt.textContent = `No preview available for ${asset.pub.mediaType} (${(asset.pub.buffer as ArrayBuffer).byteLength} bytes).`;
      else noPreviewElt.textContent = `No data uploaded yet.`;
      break;
  }
}

function setupMediaInfo() {
  if (projectClient.entries == null || asset == null) return;

  (document.querySelector("input.mediaType") as HTMLInputElement).value = asset.pub.mediaType;

  let entry = projectClient.entries.byId[SupClient.query.asset];
  outputFilename = entry.name;

  let dotIndex = entry.name.indexOf(".");
  if (dotIndex === -1) {
    let extension = (dotIndex !== -1) ? entry.name.slice(dotIndex + 1) : defaultExtensions[asset.pub.mediaType];
    if (extension == null) extension = "dat";
    outputFilename += `.${extension}`;
  }

  (document.querySelector("input.filename") as HTMLInputElement).value = outputFilename;
}

function onAssetEdited(assetId: string, command: string, ...args: any[]) {
  if (command === "upload") {
    setupPreview();
    setupMediaInfo();
  }
}

function onFileSelectChange(event: any) {
  if (event.target.files.length === 0) return;

  let mediaType = event.target.files[0].type;
  if (mediaType.length === 0) mediaType = "application/octet-stream";

  let reader = new FileReader();
  reader.onload = (event) => {
    socket.emit("edit:assets", SupClient.query.asset, "upload", mediaType, reader.result, (err: string) => {
      if (err != null) { alert(err); return; }
    });
  };
  reader.readAsArrayBuffer(event.target.files[0]);
  event.target.parentElement.reset();
}

function onDownloadBlob() {
  if (previewObjectURL == null || outputFilename == null) return;

  function triggerDownload(name: string) {
    let anchor = document.createElement("a");
    document.body.appendChild(anchor);
    anchor.style.display = "none";
    anchor.href = previewObjectURL;

    // Not yet supported in IE and Safari (http://caniuse.com/#feat=download)
    (anchor as any).download = name;
    anchor.click();
    document.body.removeChild(anchor);
  }

  let options = {
    initialValue: outputFilename,
    validationLabel: SupClient.i18n.t("common:actions.download")
  };

  if (SupClient.isApp) {
    triggerDownload(options.initialValue);
  } else {
    /* tslint:disable:no-unused-expression */
    new SupClient.dialogs.PromptDialog(SupClient.i18n.t("blobEditor:sidebar.settings.sound.file.download.prompt"), options, (name) => {
      /* tslint:enable:no-unused-expression */
      if (name == null) return;
      triggerDownload(name);
    });
  }
}
