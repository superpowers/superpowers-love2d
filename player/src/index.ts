/// <reference path="../../../../typings/tsd.d.ts" />
/// <reference path="../../../../SupClient/typings/SupApp.d.ts" />

import * as async from "async";
import * as querystring from "querystring";
import supFetch from "../../../../SupClient/src/fetch";
import * as path from "path";

const statusElt = document.querySelector(".status") as HTMLDivElement;
let tempFolderPath: string;

const qs = querystring.parse(window.location.search.slice(1));
const buildPath = (qs.project != null) ? `/builds/${qs.project}/${qs.build}/` : "./";

document.addEventListener("keydown", (event) => {
  // F12
  if (event.keyCode === 123) SupApp.getCurrentWindow().webContents.toggleDevTools();
});

function start() {
  if ((window as any).SupApp == null) {
    statusElt.textContent = "Can't run in browser";
    (document.querySelector(".must-use-app") as HTMLDivElement).hidden = false;
    return;
  }

  document.body.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).tagName !== "A") return;
    event.preventDefault();
    SupApp.openLink((event.target as HTMLAnchorElement).href);
  });

  if (localStorage["supLove2DPath"] == null) {
    showLocateLove();
  } else {
    SupApp.tryFileAccess(localStorage["supLove2DPath"], "execute", (err) => {
      if (err != null) { showLocateLove(); return; }
      downloadGame();
    });
  }
}

function showLocateLove() {
  (document.querySelector(".where-is-love") as HTMLDivElement).hidden = false;
  document.querySelector(".where-is-love button").addEventListener("click", onLocateLoveClick);
}

function onLocateLoveClick(event: Event) {
  SupApp.chooseFile("execute", (file) => {
    if (file == null) return;

    (document.querySelector(".where-is-love") as HTMLDivElement).hidden = true;
    localStorage["supLove2DPath"] = file;
    downloadGame();
  });
}

interface Project {
  name: string;
  assets: Entry[];
}

interface Entry {
  id: string;
  name: string;
  type: string;
  children?: any[];
}

function downloadGame() {
  statusElt.textContent = "Downloading game...";

  SupApp.mktmpdir((err, createdFolderPath) => {
    if (err != null) { statusElt.textContent = `Could not create temporary folder: ${err.message}`; return; }

    tempFolderPath = createdFolderPath;

    supFetch(`${buildPath}files.json`, "json", (err, filesToDownload) => {
      if (err != null) { statusElt.textContent = `Could not load files list: ${err.message}`; return; }

      async.each(filesToDownload, downloadFile, (err) => {
        if (err != null) { statusElt.textContent = `Could not download all files: ${err.message}`; return; }

        runGame();
      });
    });
  });
}

function downloadFile(filePath: string, callback: ErrorCallback) {
  const inputPath = `${window.location.origin}${buildPath}files/${filePath}`;
  const outputPath = path.join(tempFolderPath, filePath);

  SupApp.mkdirp(path.dirname(outputPath), (err) => {
    supFetch(inputPath, "arraybuffer", (err, data) => {
      if (err != null) { callback(err); return; }

      SupApp.writeFile(outputPath, Buffer.from(data), callback);
    });
  });
}

function runGame() {
  statusElt.textContent = "Running LÖVE...";

  SupApp.spawnChildProcess(localStorage["supLove2DPath"], [ tempFolderPath ], (err, loveProcess) => {
    SupApp.getCurrentWindow().hide();

    let failed = false;
    loveProcess.on("error", (err: Error) => {
      failed = true;
      SupApp.getCurrentWindow().show();
      statusElt.textContent = `Could not start LÖVE: ${err.message}`;
      localStorage.removeItem("supLove2DPath");
    });
    loveProcess.on("exit", () => { if (!failed) window.close(); });
  });
}

start();
