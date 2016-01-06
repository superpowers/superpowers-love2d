import LuaAsset from "../../data/LuaAsset";

SupClient.setupHotkeys();

let socket: SocketIOClient.Socket;
let projectClient: SupClient.ProjectClient;
let editor: TextEditorWidget;
let asset: LuaAsset;

socket = SupClient.connect(SupClient.query.project);
socket.on("welcome", onWelcome);
socket.on("disconnect", SupClient.onDisconnected);

function onWelcome(clientId: number) {
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
}

function onAssetEdited(assetId: string, command: string, ...args: any[]) {
  if (command === "editText") {
    // errorPaneStatus.classList.add("has-draft");
    editor.receiveEditText(args[0]);
  } else if (command === "applyDraftChanges") {
    // errorPaneStatus.classList.remove("has-draft");
  }
}

function setupEditor(clientId: number) {
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
  socket.emit("edit:assets", SupClient.query.asset, "applyDraftChanges", (err: string) => { if (err != null) { alert(err); SupClient.onDisconnected(); }});
}
