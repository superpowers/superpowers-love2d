/// <reference path="../../../../typings/tsd.d.ts" />

import * as async from "async";
import * as querystring from "querystring";
import supFetch from "../../../../SupClient/src/fetch";
import * as dummy_fs from "fs";
import * as dummy_path from "path";
import * as dummy_http from "http";

let isApp = window.navigator.userAgent.indexOf("Electron") !== -1;
let nodeRequire: NodeRequire;

let electron: Electron.ElectronMainAndRenderer;
let fs: typeof dummy_fs;
let path: typeof dummy_path;
let http: typeof dummy_http;

if (isApp) {
  nodeRequire = (top as any).global.require;
  electron = nodeRequire("electron");
  fs = nodeRequire("fs");
  path = nodeRequire("path");
  http = nodeRequire("http");
}

let statusElt = document.querySelector(".status") as HTMLDivElement;
let tempFolderPath: string;

let qs = querystring.parse(window.location.search.slice(1));
let buildPath = (qs.project != null) ? `/builds/${qs.project}/${qs.build}/` : "./";

function start() {
  if (!isApp) {
    statusElt.textContent = "Can't run in browser";
    (document.querySelector(".must-use-app") as HTMLDivElement).hidden = false;
    return;
  }

  document.body.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).tagName !== "A") return;
    event.preventDefault();
    electron.shell.openExternal((event.target as HTMLAnchorElement).href);
  });

  if (localStorage["supLove2DPath"] == null || !fs.existsSync(localStorage["supLove2DPath"])) {
    (document.querySelector(".where-is-love") as HTMLDivElement).hidden = false;
    document.querySelector(".where-is-love button").addEventListener("click", onLocateLoveClick);
  } else downloadGame();
}

function onLocateLoveClick(event: Event) {
  electron.remote.dialog.showOpenDialog({ properties: ["openFile"] }, (files) => {
    if (files == null || files.length === 0) return;

    (document.querySelector(".where-is-love") as HTMLDivElement).hidden = true;
    localStorage["supLove2DPath"] = files[0];
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

function createTempFolder(callback: (err: Error) => any) {
  let tmpRoot = nodeRequire("os").tmpdir();

  let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  function randomChar() {
    return characters[Math.floor(Math.random() * characters.length)];
  }

  async.retry(10, (cb: ErrorCallback) => {
    let folderName = "sup-love2d-";
    for (let i = 0; i < 16; i++) folderName += randomChar();

    tempFolderPath = `${tmpRoot}/${folderName}`;
    fs.mkdir(tempFolderPath, cb);
  }, callback);
}

function downloadGame() {
  statusElt.textContent = "Downloading game...";

  createTempFolder((err) => {
    if (err != null) {
      statusElt.textContent = `Could not create temporary folder: ${err.message}`;
      return;
    }

    supFetch(`${buildPath}project.json`, "json", (err, project) => {
      if (err != null) {
        statusElt.textContent = `Could not load project: ${err.message}`;
        return;
      }

      downloadAssets(project);
    });
  });
}

function downloadAssets(project: Project) {
  let foldersToCreate: string[] = [];
  let assetsToLoad: string[] = [];

  function walk(entry: Entry, parentPath: string) {
    let assetPath = (parentPath.length > 0) ? `${parentPath}/${entry.name}` : entry.name;

    if (entry.children != null) {
      foldersToCreate.push(assetPath);
      for (let child of entry.children) walk(child, assetPath);
    } else {
      assetsToLoad.push(assetPath);
    }
  }

  for (let asset of project.assets) walk(asset, "");
  async.eachSeries(foldersToCreate, createAssetFolder, () => {
    async.eachSeries(assetsToLoad, downloadAsset, () => { runGame(); });
  });
}

function createAssetFolder(folderPath: string, callback: ErrorCallback) {
  let outputPath = path.join(tempFolderPath, folderPath);
  fs.mkdir(outputPath, callback);
}

function downloadAsset(assetPath: string, callback: ErrorCallback) {
  let inputPath = `${window.location.origin}${buildPath}assets/${assetPath}`;
  let outputPath = path.join(tempFolderPath, assetPath);

  http.get(inputPath, (response) => {
    let localFile = fs.createWriteStream(outputPath);
    localFile.on("finish", () => { callback(null); });
    response.pipe(localFile);
  }).on("error", callback);
}

function runGame() {
  statusElt.textContent = "Running LÖVE...";
  let childProcess = (top as any).global.require("child_process");
  let loveProcess = childProcess.spawn(localStorage["supLove2DPath"], [ tempFolderPath ]);
  electron.remote.getCurrentWindow().hide();

  let failed = false;
  loveProcess.on("error", (err: Error) => {
    failed = true;
    statusElt.textContent = `Could not start LÖVE: ${err.message}`;
    localStorage.removeItem("supLove2DPath");
    return;
  });
  loveProcess.on("exit", () => { if (!failed) window.close(); });
}

start();
