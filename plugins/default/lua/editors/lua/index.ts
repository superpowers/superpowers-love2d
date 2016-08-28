import LuaAsset from "../../data/LuaAsset";

let socket: SocketIOClient.Socket;
let projectClient: SupClient.ProjectClient;
let editor: TextEditorWidget;
let asset: LuaAsset;

SupClient.i18n.load([{ root: `${window.location.pathname}/../..`, name: "scriptEditor" }], () => {
  socket = SupClient.connect(SupClient.query.project);
  socket.on("welcome", onWelcome);
  socket.on("disconnect", SupClient.onDisconnected);
});

const statusPaneHeader = document.querySelector(".status-pane .header");
const statusPaneSaveButton = statusPaneHeader.querySelector(".save") as HTMLButtonElement;
const statusPaneInfo = statusPaneHeader.querySelector(".info");

statusPaneSaveButton.addEventListener("click", (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  applyDraftChanges();
});

function onWelcome(clientId: string) {
  projectClient = new SupClient.ProjectClient(socket);
  setupEditor(clientId);

  let subscriber: SupClient.AssetSubscriber = {
    onAssetReceived, onAssetEdited,
    onAssetTrashed: SupClient.onAssetTrashed
  };

  projectClient.subAsset(SupClient.query.asset, "lua", subscriber);
}

function onAssetReceived(assetId: string, theAsset: LuaAsset) {
  asset = theAsset;
  editor.setText(asset.pub.draft);
  statusPaneInfo.textContent = SupClient.i18n.t("scriptEditor:ready");
}

function onAssetEdited(assetId: string, command: string, ...args: any[]) {
  if (command === "editText") {
    statusPaneHeader.classList.add("has-draft");
    editor.receiveEditText(args[0]);
  } else if (command === "applyDraftChanges") {
    statusPaneHeader.classList.remove("has-draft");
  }
}

function setupEditor(clientId: string) {
  let textArea = <HTMLTextAreaElement>document.querySelector(".text-editor");
  editor = new TextEditorWidget(projectClient, clientId, textArea, {
    mode: "text/x-lua",
    extraKeys: {
      "Ctrl-S": () => { applyDraftChanges(); },
      "Cmd-S": () => { applyDraftChanges(); },
    },
    editCallback: onEditText,
    sendOperationCallback: onSendOperation
  });
}

function onEditText(text: string, origin: string) { /* Ignore */ }

function onSendOperation(operation: OperationData) {
  socket.emit("edit:assets", SupClient.query.asset, "editText", operation, asset.document.getRevisionId(), (err: string) => {
    if (err != null) { alert(err); SupClient.onDisconnected(); }
  });
}

function applyDraftChanges() {
  statusPaneSaveButton.disabled = true;
  statusPaneSaveButton.textContent = SupClient.i18n.t("common:states.saving");

  socket.emit("edit:assets", SupClient.query.asset, "applyDraftChanges", (err: string) => {
    if (err != null) { alert(err); SupClient.onDisconnected(); return; }

    statusPaneSaveButton.disabled = false;
    statusPaneSaveButton.textContent = SupClient.i18n.t("common:actions.applyChanges");
  });
}
