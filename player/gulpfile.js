"use strict";

const gulp = require("gulp");

// TypeScript
const ts = require("gulp-typescript");
const tsProject = ts.createProject("./tsconfig.json");
const tslint = require("gulp-tslint");

gulp.task("typescript", () => {
  let failed = false;
  const tsResult = tsProject.src()
    .pipe(tslint({ formatter: "prose" }))
    .pipe(tslint.report({ emitError: true }))
    .on("error", (err) => { throw err; })
    .pipe(tsProject())
    .on("error", () => { failed = true; })
    .on("end", () => { if (failed) throw new Error("There were TypeScript errors."); });
  return tsResult.js.pipe(gulp.dest("./"));
});

// Browserify
const browserify = require("browserify");
const source = require("vinyl-source-stream");
gulp.task("browserify", () => {
  const bundler = browserify("./index.js");
  function bundle() { return bundler.bundle().pipe(source("index.js")).pipe(gulp.dest("../public")); }
  return bundle();
});

// All
gulp.task("default", gulp.series("typescript", "browserify"));
