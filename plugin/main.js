var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/services/slack-sender.ts
var slack_sender_exports = {};
__export(slack_sender_exports, {
  sendToSlack: () => sendToSlack,
  testSlackConnection: () => testSlackConnection
});
async function testSlackConnection(webhookUrl) {
  if (!webhookUrl) return { success: false, error: "Webhook URL\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4." };
  try {
    const resp = await (0, import_obsidian.requestUrl)({
      url: webhookUrl,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({ text: "MeetNote \uC5F0\uACB0 \uD14C\uC2A4\uD2B8 \uC131\uACF5 :white_check_mark:" })
    });
    if (resp.status === 200) return { success: true };
    return { success: false, error: `Slack \uC751\uB2F5: ${resp.status}` };
  } catch (err) {
    return { success: false, error: `\uC5F0\uACB0 \uC2E4\uD328: ${err}` };
  }
}
async function sendToSlack(config, segments, speakerMap, summary, speakingStats, startTime) {
  if (!config.enabled || !config.webhookUrl) {
    return { success: false, error: "Slack\uC774 \uBE44\uD65C\uC131\uD654 \uC0C1\uD0DC\uC785\uB2C8\uB2E4." };
  }
  try {
    const blocks = buildBlocks(segments, speakerMap, summary, speakingStats, startTime);
    const resp = await (0, import_obsidian.requestUrl)({
      url: config.webhookUrl,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        blocks,
        text: `[MeetNote] \uD68C\uC758\uB85D \u2014 ${startTime || ""}`
      })
    });
    if (resp.status === 200) return { success: true };
    return { success: false, error: `Slack \uC804\uC1A1 \uC2E4\uD328: ${resp.status}` };
  } catch (err) {
    return { success: false, error: `\uC804\uC1A1 \uC624\uB958: ${err}` };
  }
}
function buildBlocks(segments, speakerMap, summary, speakingStats, startTime) {
  const blocks = [];
  blocks.push({
    type: "header",
    text: { type: "plain_text", text: `:memo: \uD68C\uC758\uB85D \u2014 ${startTime || ""}`, emoji: true }
  });
  const speakers = Object.values(speakerMap);
  if (speakers.length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*\uCC38\uC11D\uC790:* ${speakers.join(", ")}` }
    });
  }
  if (summary) {
    blocks.push({ type: "divider" });
    const text = summary.length <= BLOCK_TEXT_LIMIT ? summary : summary.slice(0, BLOCK_TEXT_LIMIT) + "\n_(\uC694\uC57D \uC77C\uBD80 \uC0DD\uB7B5)_";
    blocks.push({ type: "section", text: { type: "mrkdwn", text } });
  }
  if (speakingStats.length > 0) {
    blocks.push({ type: "divider" });
    const lines = ["*\uBC1C\uC5B8 \uBE44\uC728*"];
    for (const stat of speakingStats) {
      const barLen = Math.round(stat.ratio * 10);
      const bar = "\u2588".repeat(barLen) + "\u2591".repeat(10 - barLen);
      const mins = Math.floor(stat.total_seconds / 60);
      const secs = Math.round(stat.total_seconds % 60);
      lines.push(`\`${bar}\` ${stat.speaker} ${Math.round(stat.ratio * 100)}% (${mins}\uBD84 ${secs}\uCD08)`);
    }
    blocks.push({ type: "section", text: { type: "mrkdwn", text: lines.join("\n") } });
  }
  if (blocks.length > 50) blocks.length = 50;
  return blocks;
}
var import_obsidian, BLOCK_TEXT_LIMIT;
var init_slack_sender = __esm({
  "src/services/slack-sender.ts"() {
    import_obsidian = require("obsidian");
    BLOCK_TEXT_LIMIT = 2900;
  }
});

// node_modules/sherpa-onnx/sherpa-onnx-wasm-nodejs.js
var require_sherpa_onnx_wasm_nodejs = __commonJS({
  "node_modules/sherpa-onnx/sherpa-onnx-wasm-nodejs.js"(exports2, module2) {
    var Module = (() => {
      var _scriptDir = typeof document !== "undefined" && document.currentScript ? document.currentScript.src : void 0;
      if (typeof __filename !== "undefined") _scriptDir = _scriptDir || __filename;
      return function(moduleArg = {}) {
        var Module2 = moduleArg;
        var readyPromiseResolve, readyPromiseReject;
        Module2["ready"] = new Promise((resolve, reject) => {
          readyPromiseResolve = resolve;
          readyPromiseReject = reject;
        });
        var moduleOverrides = Object.assign({}, Module2);
        var arguments_ = [];
        var thisProgram = "./this.program";
        var quit_ = (status, toThrow) => {
          throw toThrow;
        };
        var ENVIRONMENT_IS_WEB = typeof window == "object";
        var ENVIRONMENT_IS_WORKER = typeof importScripts == "function";
        var ENVIRONMENT_IS_NODE = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string";
        var scriptDirectory = "";
        function locateFile(path4) {
          if (Module2["locateFile"]) {
            return Module2["locateFile"](path4, scriptDirectory);
          }
          return scriptDirectory + path4;
        }
        var read_, readAsync, readBinary;
        if (ENVIRONMENT_IS_NODE) {
          var fs2 = require("fs");
          var nodePath = require("path");
          if (ENVIRONMENT_IS_WORKER) {
            scriptDirectory = nodePath.dirname(scriptDirectory) + "/";
          } else {
            scriptDirectory = __dirname + "/";
          }
          read_ = (filename, binary) => {
            filename = isFileURI(filename) ? new URL(filename) : nodePath.normalize(filename);
            return fs2.readFileSync(filename, binary ? void 0 : "utf8");
          };
          readBinary = (filename) => {
            var ret = read_(filename, true);
            if (!ret.buffer) {
              ret = new Uint8Array(ret);
            }
            return ret;
          };
          readAsync = (filename, onload, onerror, binary = true) => {
            filename = isFileURI(filename) ? new URL(filename) : nodePath.normalize(filename);
            fs2.readFile(filename, binary ? void 0 : "utf8", (err2, data) => {
              if (err2) onerror(err2);
              else onload(binary ? data.buffer : data);
            });
          };
          if (!Module2["thisProgram"] && process.argv.length > 1) {
            thisProgram = process.argv[1].replace(/\\/g, "/");
          }
          arguments_ = process.argv.slice(2);
          quit_ = (status, toThrow) => {
            process.exitCode = status;
            throw toThrow;
          };
          Module2["inspect"] = () => "[Emscripten Module object]";
        } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
          if (ENVIRONMENT_IS_WORKER) {
            scriptDirectory = self.location.href;
          } else if (typeof document != "undefined" && document.currentScript) {
            scriptDirectory = document.currentScript.src;
          }
          if (_scriptDir) {
            scriptDirectory = _scriptDir;
          }
          if (scriptDirectory.indexOf("blob:") !== 0) {
            scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
          } else {
            scriptDirectory = "";
          }
          {
            read_ = (url) => {
              var xhr = new XMLHttpRequest();
              xhr.open("GET", url, false);
              xhr.send(null);
              return xhr.responseText;
            };
            if (ENVIRONMENT_IS_WORKER) {
              readBinary = (url) => {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, false);
                xhr.responseType = "arraybuffer";
                xhr.send(null);
                return new Uint8Array(xhr.response);
              };
            }
            readAsync = (url, onload, onerror) => {
              var xhr = new XMLHttpRequest();
              xhr.open("GET", url, true);
              xhr.responseType = "arraybuffer";
              xhr.onload = () => {
                if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                  onload(xhr.response);
                  return;
                }
                onerror();
              };
              xhr.onerror = onerror;
              xhr.send(null);
            };
          }
        } else {
        }
        var out = Module2["print"] || console.log.bind(console);
        var err = Module2["printErr"] || console.error.bind(console);
        Object.assign(Module2, moduleOverrides);
        moduleOverrides = null;
        if (Module2["arguments"]) arguments_ = Module2["arguments"];
        if (Module2["thisProgram"]) thisProgram = Module2["thisProgram"];
        if (Module2["quit"]) quit_ = Module2["quit"];
        var wasmBinary;
        if (Module2["wasmBinary"]) wasmBinary = Module2["wasmBinary"];
        if (typeof WebAssembly != "object") {
          abort("no native wasm support detected");
        }
        var wasmMemory;
        var ABORT = false;
        var EXITSTATUS;
        function assert(condition, text) {
          if (!condition) {
            abort(text);
          }
        }
        var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
        function updateMemoryViews() {
          var b = wasmMemory.buffer;
          Module2["HEAP8"] = HEAP8 = new Int8Array(b);
          Module2["HEAP16"] = HEAP16 = new Int16Array(b);
          Module2["HEAPU8"] = HEAPU8 = new Uint8Array(b);
          Module2["HEAPU16"] = HEAPU16 = new Uint16Array(b);
          Module2["HEAP32"] = HEAP32 = new Int32Array(b);
          Module2["HEAPU32"] = HEAPU32 = new Uint32Array(b);
          Module2["HEAPF32"] = HEAPF32 = new Float32Array(b);
          Module2["HEAPF64"] = HEAPF64 = new Float64Array(b);
        }
        var __ATPRERUN__ = [];
        var __ATINIT__ = [];
        var __ATPOSTRUN__ = [];
        var runtimeInitialized = false;
        function preRun() {
          if (Module2["preRun"]) {
            if (typeof Module2["preRun"] == "function") Module2["preRun"] = [Module2["preRun"]];
            while (Module2["preRun"].length) {
              addOnPreRun(Module2["preRun"].shift());
            }
          }
          callRuntimeCallbacks(__ATPRERUN__);
        }
        function initRuntime() {
          runtimeInitialized = true;
          if (!Module2["noFSInit"] && !FS.init.initialized) FS.init();
          FS.ignorePermissions = false;
          TTY.init();
          callRuntimeCallbacks(__ATINIT__);
        }
        function postRun() {
          if (Module2["postRun"]) {
            if (typeof Module2["postRun"] == "function") Module2["postRun"] = [Module2["postRun"]];
            while (Module2["postRun"].length) {
              addOnPostRun(Module2["postRun"].shift());
            }
          }
          callRuntimeCallbacks(__ATPOSTRUN__);
        }
        function addOnPreRun(cb) {
          __ATPRERUN__.unshift(cb);
        }
        function addOnInit(cb) {
          __ATINIT__.unshift(cb);
        }
        function addOnPostRun(cb) {
          __ATPOSTRUN__.unshift(cb);
        }
        var runDependencies = 0;
        var runDependencyWatcher = null;
        var dependenciesFulfilled = null;
        function getUniqueRunDependency(id) {
          return id;
        }
        function addRunDependency(id) {
          runDependencies++;
          Module2["monitorRunDependencies"]?.(runDependencies);
        }
        function removeRunDependency(id) {
          runDependencies--;
          Module2["monitorRunDependencies"]?.(runDependencies);
          if (runDependencies == 0) {
            if (runDependencyWatcher !== null) {
              clearInterval(runDependencyWatcher);
              runDependencyWatcher = null;
            }
            if (dependenciesFulfilled) {
              var callback = dependenciesFulfilled;
              dependenciesFulfilled = null;
              callback();
            }
          }
        }
        function abort(what) {
          Module2["onAbort"]?.(what);
          what = "Aborted(" + what + ")";
          err(what);
          ABORT = true;
          EXITSTATUS = 1;
          what += ". Build with -sASSERTIONS for more info.";
          var e = new WebAssembly.RuntimeError(what);
          readyPromiseReject(e);
          throw e;
        }
        var dataURIPrefix = "data:application/octet-stream;base64,";
        var isDataURI = (filename) => filename.startsWith(dataURIPrefix);
        var isFileURI = (filename) => filename.startsWith("file://");
        var wasmBinaryFile;
        wasmBinaryFile = "sherpa-onnx-wasm-nodejs.wasm";
        if (!isDataURI(wasmBinaryFile)) {
          wasmBinaryFile = locateFile(wasmBinaryFile);
        }
        function getBinarySync(file) {
          if (file == wasmBinaryFile && wasmBinary) {
            return new Uint8Array(wasmBinary);
          }
          if (readBinary) {
            return readBinary(file);
          }
          throw "sync fetching of the wasm failed: you can preload it to Module['wasmBinary'] manually, or emcc.py will do that for you when generating HTML (but not JS)";
        }
        function instantiateSync(file, info) {
          var module3;
          var binary = getBinarySync(file);
          module3 = new WebAssembly.Module(binary);
          var instance = new WebAssembly.Instance(module3, info);
          return [instance, module3];
        }
        function createWasm() {
          var info = { "a": wasmImports };
          function receiveInstance(instance, module3) {
            wasmExports = instance.exports;
            wasmMemory = wasmExports["M"];
            updateMemoryViews();
            wasmTable = wasmExports["Ob"];
            addOnInit(wasmExports["N"]);
            removeRunDependency("wasm-instantiate");
            return wasmExports;
          }
          addRunDependency("wasm-instantiate");
          if (Module2["instantiateWasm"]) {
            try {
              return Module2["instantiateWasm"](info, receiveInstance);
            } catch (e) {
              err(`Module.instantiateWasm callback failed with error: ${e}`);
              readyPromiseReject(e);
            }
          }
          var result = instantiateSync(wasmBinaryFile, info);
          return receiveInstance(result[0]);
        }
        var tempDouble;
        var tempI64;
        var ASM_CONSTS = { 1276664: ($0, $1, $2, $3) => {
          if (typeof Module2 == "undefined" || !Module2.MountedFiles) {
            return 1;
          }
          let fileName = UTF8ToString($0 >>> 0);
          if (fileName.startsWith("./")) {
            fileName = fileName.substring(2);
          }
          const fileData = Module2.MountedFiles.get(fileName);
          if (!fileData) {
            return 2;
          }
          const offset = $1 >>> 0;
          const length = $2 >>> 0;
          const buffer = $3 >>> 0;
          if (offset + length > fileData.byteLength) {
            return 3;
          }
          try {
            HEAPU8.set(fileData.subarray(offset, offset + length), buffer);
            return 0;
          } catch {
            return 4;
          }
        } };
        function ExitStatus(status) {
          this.name = "ExitStatus";
          this.message = `Program terminated with exit(${status})`;
          this.status = status;
        }
        var callRuntimeCallbacks = (callbacks) => {
          while (callbacks.length > 0) {
            callbacks.shift()(Module2);
          }
        };
        function getValue(ptr, type = "i8") {
          if (type.endsWith("*")) type = "*";
          switch (type) {
            case "i1":
              return HEAP8[ptr >> 0];
            case "i8":
              return HEAP8[ptr >> 0];
            case "i16":
              return HEAP16[ptr >> 1];
            case "i32":
              return HEAP32[ptr >> 2];
            case "i64":
              abort("to do getValue(i64) use WASM_BIGINT");
            case "float":
              return HEAPF32[ptr >> 2];
            case "double":
              return HEAPF64[ptr >> 3];
            case "*":
              return HEAPU32[ptr >> 2];
            default:
              abort(`invalid type for getValue: ${type}`);
          }
        }
        var noExitRuntime = Module2["noExitRuntime"] || true;
        function setValue(ptr, value, type = "i8") {
          if (type.endsWith("*")) type = "*";
          switch (type) {
            case "i1":
              HEAP8[ptr >> 0] = value;
              break;
            case "i8":
              HEAP8[ptr >> 0] = value;
              break;
            case "i16":
              HEAP16[ptr >> 1] = value;
              break;
            case "i32":
              HEAP32[ptr >> 2] = value;
              break;
            case "i64":
              abort("to do setValue(i64) use WASM_BIGINT");
            case "float":
              HEAPF32[ptr >> 2] = value;
              break;
            case "double":
              HEAPF64[ptr >> 3] = value;
              break;
            case "*":
              HEAPU32[ptr >> 2] = value;
              break;
            default:
              abort(`invalid type for setValue: ${type}`);
          }
        }
        function ExceptionInfo(excPtr) {
          this.excPtr = excPtr;
          this.ptr = excPtr - 24;
          this.set_type = function(type) {
            HEAPU32[this.ptr + 4 >> 2] = type;
          };
          this.get_type = function() {
            return HEAPU32[this.ptr + 4 >> 2];
          };
          this.set_destructor = function(destructor) {
            HEAPU32[this.ptr + 8 >> 2] = destructor;
          };
          this.get_destructor = function() {
            return HEAPU32[this.ptr + 8 >> 2];
          };
          this.set_caught = function(caught) {
            caught = caught ? 1 : 0;
            HEAP8[this.ptr + 12 >> 0] = caught;
          };
          this.get_caught = function() {
            return HEAP8[this.ptr + 12 >> 0] != 0;
          };
          this.set_rethrown = function(rethrown) {
            rethrown = rethrown ? 1 : 0;
            HEAP8[this.ptr + 13 >> 0] = rethrown;
          };
          this.get_rethrown = function() {
            return HEAP8[this.ptr + 13 >> 0] != 0;
          };
          this.init = function(type, destructor) {
            this.set_adjusted_ptr(0);
            this.set_type(type);
            this.set_destructor(destructor);
          };
          this.set_adjusted_ptr = function(adjustedPtr) {
            HEAPU32[this.ptr + 16 >> 2] = adjustedPtr;
          };
          this.get_adjusted_ptr = function() {
            return HEAPU32[this.ptr + 16 >> 2];
          };
          this.get_exception_ptr = function() {
            var isPointer = ___cxa_is_pointer_type(this.get_type());
            if (isPointer) {
              return HEAPU32[this.excPtr >> 2];
            }
            var adjusted = this.get_adjusted_ptr();
            if (adjusted !== 0) return adjusted;
            return this.excPtr;
          };
        }
        var exceptionLast = 0;
        var uncaughtExceptionCount = 0;
        var ___cxa_throw = (ptr, type, destructor) => {
          var info = new ExceptionInfo(ptr);
          info.init(type, destructor);
          exceptionLast = ptr;
          uncaughtExceptionCount++;
          throw exceptionLast;
        };
        var setErrNo = (value) => {
          HEAP32[___errno_location() >> 2] = value;
          return value;
        };
        var PATH = { isAbs: (path4) => nodePath["isAbsolute"](path4), normalize: (path4) => nodePath["normalize"](path4), dirname: (path4) => nodePath["dirname"](path4), basename: (path4) => nodePath["basename"](path4), join: function() {
          return nodePath["join"].apply(null, arguments);
        }, join2: (l, r) => nodePath["join"](l, r) };
        var initRandomFill = () => {
          if (typeof crypto == "object" && typeof crypto["getRandomValues"] == "function") {
            return (view) => crypto.getRandomValues(view);
          } else if (ENVIRONMENT_IS_NODE) {
            try {
              var crypto_module = require("crypto");
              var randomFillSync = crypto_module["randomFillSync"];
              if (randomFillSync) {
                return (view) => crypto_module["randomFillSync"](view);
              }
              var randomBytes = crypto_module["randomBytes"];
              return (view) => (view.set(randomBytes(view.byteLength)), view);
            } catch (e) {
            }
          }
          abort("initRandomDevice");
        };
        var randomFill = (view) => (randomFill = initRandomFill())(view);
        var PATH_FS = { resolve: function() {
          var paths = Array.prototype.slice.call(arguments, 0);
          paths.unshift(FS.cwd());
          return nodePath["posix"]["resolve"].apply(null, paths);
        }, relative: (from, to) => nodePath["posix"]["relative"](from || FS.cwd(), to || FS.cwd()) };
        var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder("utf8") : void 0;
        var UTF8ArrayToString = (heapOrArray, idx, maxBytesToRead) => {
          var endIdx = idx + maxBytesToRead;
          var endPtr = idx;
          while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
          if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
            return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
          }
          var str = "";
          while (idx < endPtr) {
            var u0 = heapOrArray[idx++];
            if (!(u0 & 128)) {
              str += String.fromCharCode(u0);
              continue;
            }
            var u1 = heapOrArray[idx++] & 63;
            if ((u0 & 224) == 192) {
              str += String.fromCharCode((u0 & 31) << 6 | u1);
              continue;
            }
            var u2 = heapOrArray[idx++] & 63;
            if ((u0 & 240) == 224) {
              u0 = (u0 & 15) << 12 | u1 << 6 | u2;
            } else {
              u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;
            }
            if (u0 < 65536) {
              str += String.fromCharCode(u0);
            } else {
              var ch = u0 - 65536;
              str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
            }
          }
          return str;
        };
        var FS_stdin_getChar_buffer = [];
        var lengthBytesUTF8 = (str) => {
          var len = 0;
          for (var i = 0; i < str.length; ++i) {
            var c = str.charCodeAt(i);
            if (c <= 127) {
              len++;
            } else if (c <= 2047) {
              len += 2;
            } else if (c >= 55296 && c <= 57343) {
              len += 4;
              ++i;
            } else {
              len += 3;
            }
          }
          return len;
        };
        var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
          if (!(maxBytesToWrite > 0)) return 0;
          var startIdx = outIdx;
          var endIdx = outIdx + maxBytesToWrite - 1;
          for (var i = 0; i < str.length; ++i) {
            var u = str.charCodeAt(i);
            if (u >= 55296 && u <= 57343) {
              var u1 = str.charCodeAt(++i);
              u = 65536 + ((u & 1023) << 10) | u1 & 1023;
            }
            if (u <= 127) {
              if (outIdx >= endIdx) break;
              heap[outIdx++] = u;
            } else if (u <= 2047) {
              if (outIdx + 1 >= endIdx) break;
              heap[outIdx++] = 192 | u >> 6;
              heap[outIdx++] = 128 | u & 63;
            } else if (u <= 65535) {
              if (outIdx + 2 >= endIdx) break;
              heap[outIdx++] = 224 | u >> 12;
              heap[outIdx++] = 128 | u >> 6 & 63;
              heap[outIdx++] = 128 | u & 63;
            } else {
              if (outIdx + 3 >= endIdx) break;
              heap[outIdx++] = 240 | u >> 18;
              heap[outIdx++] = 128 | u >> 12 & 63;
              heap[outIdx++] = 128 | u >> 6 & 63;
              heap[outIdx++] = 128 | u & 63;
            }
          }
          heap[outIdx] = 0;
          return outIdx - startIdx;
        };
        function intArrayFromString(stringy, dontAddNull, length) {
          var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
          var u8array = new Array(len);
          var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
          if (dontAddNull) u8array.length = numBytesWritten;
          return u8array;
        }
        var FS_stdin_getChar = () => {
          if (!FS_stdin_getChar_buffer.length) {
            var result = null;
            if (ENVIRONMENT_IS_NODE) {
              var BUFSIZE = 256;
              var buf = Buffer.alloc(BUFSIZE);
              var bytesRead = 0;
              var fd = process.stdin.fd;
              try {
                bytesRead = fs2.readSync(fd, buf);
              } catch (e) {
                if (e.toString().includes("EOF")) bytesRead = 0;
                else throw e;
              }
              if (bytesRead > 0) {
                result = buf.slice(0, bytesRead).toString("utf-8");
              } else {
                result = null;
              }
            } else if (typeof window != "undefined" && typeof window.prompt == "function") {
              result = window.prompt("Input: ");
              if (result !== null) {
                result += "\n";
              }
            } else if (typeof readline == "function") {
              result = readline();
              if (result !== null) {
                result += "\n";
              }
            }
            if (!result) {
              return null;
            }
            FS_stdin_getChar_buffer = intArrayFromString(result, true);
          }
          return FS_stdin_getChar_buffer.shift();
        };
        var TTY = { ttys: [], init() {
        }, shutdown() {
        }, register(dev, ops) {
          TTY.ttys[dev] = { input: [], output: [], ops };
          FS.registerDevice(dev, TTY.stream_ops);
        }, stream_ops: { open(stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(43);
          }
          stream.tty = tty;
          stream.seekable = false;
        }, close(stream) {
          stream.tty.ops.fsync(stream.tty);
        }, fsync(stream) {
          stream.tty.ops.fsync(stream.tty);
        }, read(stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(60);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(29);
            }
            if (result === void 0 && bytesRead === 0) {
              throw new FS.ErrnoError(6);
            }
            if (result === null || result === void 0) break;
            bytesRead++;
            buffer[offset + i] = result;
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now();
          }
          return bytesRead;
        }, write(stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(60);
          }
          try {
            for (var i = 0; i < length; i++) {
              stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
            }
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (length) {
            stream.node.timestamp = Date.now();
          }
          return i;
        } }, default_tty_ops: { get_char(tty) {
          return FS_stdin_getChar();
        }, put_char(tty, val) {
          if (val === null || val === 10) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        }, fsync(tty) {
          if (tty.output && tty.output.length > 0) {
            out(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        }, ioctl_tcgets(tty) {
          return { c_iflag: 25856, c_oflag: 5, c_cflag: 191, c_lflag: 35387, c_cc: [3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
        }, ioctl_tcsets(tty, optional_actions, data) {
          return 0;
        }, ioctl_tiocgwinsz(tty) {
          return [24, 80];
        } }, default_tty1_ops: { put_char(tty, val) {
          if (val === null || val === 10) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        }, fsync(tty) {
          if (tty.output && tty.output.length > 0) {
            err(UTF8ArrayToString(tty.output, 0));
            tty.output = [];
          }
        } } };
        var zeroMemory = (address, size) => {
          HEAPU8.fill(0, address, address + size);
          return address;
        };
        var alignMemory = (size, alignment) => Math.ceil(size / alignment) * alignment;
        var mmapAlloc = (size) => {
          size = alignMemory(size, 65536);
          var ptr = _emscripten_builtin_memalign(65536, size);
          if (!ptr) return 0;
          return zeroMemory(ptr, size);
        };
        var MEMFS = { ops_table: null, mount(mount) {
          return MEMFS.createNode(null, "/", 16384 | 511, 0);
        }, createNode(parent, name, mode, dev) {
          if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
            throw new FS.ErrnoError(63);
          }
          MEMFS.ops_table ||= { dir: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr, lookup: MEMFS.node_ops.lookup, mknod: MEMFS.node_ops.mknod, rename: MEMFS.node_ops.rename, unlink: MEMFS.node_ops.unlink, rmdir: MEMFS.node_ops.rmdir, readdir: MEMFS.node_ops.readdir, symlink: MEMFS.node_ops.symlink }, stream: { llseek: MEMFS.stream_ops.llseek } }, file: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr }, stream: { llseek: MEMFS.stream_ops.llseek, read: MEMFS.stream_ops.read, write: MEMFS.stream_ops.write, allocate: MEMFS.stream_ops.allocate, mmap: MEMFS.stream_ops.mmap, msync: MEMFS.stream_ops.msync } }, link: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr, readlink: MEMFS.node_ops.readlink }, stream: {} }, chrdev: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr }, stream: FS.chrdev_stream_ops } };
          var node = FS.createNode(parent, name, mode, dev);
          if (FS.isDir(node.mode)) {
            node.node_ops = MEMFS.ops_table.dir.node;
            node.stream_ops = MEMFS.ops_table.dir.stream;
            node.contents = {};
          } else if (FS.isFile(node.mode)) {
            node.node_ops = MEMFS.ops_table.file.node;
            node.stream_ops = MEMFS.ops_table.file.stream;
            node.usedBytes = 0;
            node.contents = null;
          } else if (FS.isLink(node.mode)) {
            node.node_ops = MEMFS.ops_table.link.node;
            node.stream_ops = MEMFS.ops_table.link.stream;
          } else if (FS.isChrdev(node.mode)) {
            node.node_ops = MEMFS.ops_table.chrdev.node;
            node.stream_ops = MEMFS.ops_table.chrdev.stream;
          }
          node.timestamp = Date.now();
          if (parent) {
            parent.contents[name] = node;
            parent.timestamp = node.timestamp;
          }
          return node;
        }, getFileDataAsTypedArray(node) {
          if (!node.contents) return new Uint8Array(0);
          if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
          return new Uint8Array(node.contents);
        }, expandFileStorage(node, newCapacity) {
          var prevCapacity = node.contents ? node.contents.length : 0;
          if (prevCapacity >= newCapacity) return;
          var CAPACITY_DOUBLING_MAX = 1024 * 1024;
          newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) >>> 0);
          if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
          var oldContents = node.contents;
          node.contents = new Uint8Array(newCapacity);
          if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
        }, resizeFileStorage(node, newSize) {
          if (node.usedBytes == newSize) return;
          if (newSize == 0) {
            node.contents = null;
            node.usedBytes = 0;
          } else {
            var oldContents = node.contents;
            node.contents = new Uint8Array(newSize);
            if (oldContents) {
              node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
            }
            node.usedBytes = newSize;
          }
        }, node_ops: { getattr(node) {
          var attr = {};
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.timestamp);
          attr.mtime = new Date(node.timestamp);
          attr.ctime = new Date(node.timestamp);
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        }, setattr(node, attr) {
          if (attr.mode !== void 0) {
            node.mode = attr.mode;
          }
          if (attr.timestamp !== void 0) {
            node.timestamp = attr.timestamp;
          }
          if (attr.size !== void 0) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        }, lookup(parent, name) {
          throw FS.genericErrors[44];
        }, mknod(parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        }, rename(old_node, new_dir, new_name) {
          if (FS.isDir(old_node.mode)) {
            var new_node;
            try {
              new_node = FS.lookupNode(new_dir, new_name);
            } catch (e) {
            }
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(55);
              }
            }
          }
          delete old_node.parent.contents[old_node.name];
          old_node.parent.timestamp = Date.now();
          old_node.name = new_name;
          new_dir.contents[new_name] = old_node;
          new_dir.timestamp = old_node.parent.timestamp;
          old_node.parent = new_dir;
        }, unlink(parent, name) {
          delete parent.contents[name];
          parent.timestamp = Date.now();
        }, rmdir(parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(55);
          }
          delete parent.contents[name];
          parent.timestamp = Date.now();
        }, readdir(node) {
          var entries = [".", ".."];
          for (var key of Object.keys(node.contents)) {
            entries.push(key);
          }
          return entries;
        }, symlink(parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
          node.link = oldpath;
          return node;
        }, readlink(node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(28);
          }
          return node.link;
        } }, stream_ops: { read(stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          if (size > 8 && contents.subarray) {
            buffer.set(contents.subarray(position, position + size), offset);
          } else {
            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
          }
          return size;
        }, write(stream, buffer, offset, length, position, canOwn) {
          if (buffer.buffer === HEAP8.buffer) {
            canOwn = false;
          }
          if (!length) return 0;
          var node = stream.node;
          node.timestamp = Date.now();
          if (buffer.subarray && (!node.contents || node.contents.subarray)) {
            if (canOwn) {
              node.contents = buffer.subarray(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (node.usedBytes === 0 && position === 0) {
              node.contents = buffer.slice(offset, offset + length);
              node.usedBytes = length;
              return length;
            } else if (position + length <= node.usedBytes) {
              node.contents.set(buffer.subarray(offset, offset + length), position);
              return length;
            }
          }
          MEMFS.expandFileStorage(node, position + length);
          if (node.contents.subarray && buffer.subarray) {
            node.contents.set(buffer.subarray(offset, offset + length), position);
          } else {
            for (var i = 0; i < length; i++) {
              node.contents[position + i] = buffer[offset + i];
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position + length);
          return length;
        }, llseek(stream, offset, whence) {
          var position = offset;
          if (whence === 1) {
            position += stream.position;
          } else if (whence === 2) {
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(28);
          }
          return position;
        }, allocate(stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length);
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
        }, mmap(stream, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          if (!(flags & 2) && contents.buffer === HEAP8.buffer) {
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            if (position > 0 || position + length < contents.length) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length);
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length);
              }
            }
            allocated = true;
            ptr = mmapAlloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(48);
            }
            HEAP8.set(contents, ptr);
          }
          return { ptr, allocated };
        }, msync(stream, buffer, offset, length, mmapFlags) {
          MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          return 0;
        } } };
        var asyncLoad = (url, onload, onerror, noRunDep) => {
          var dep = !noRunDep ? getUniqueRunDependency(`al ${url}`) : "";
          readAsync(url, (arrayBuffer) => {
            assert(arrayBuffer, `Loading data file "${url}" failed (no arrayBuffer).`);
            onload(new Uint8Array(arrayBuffer));
            if (dep) removeRunDependency(dep);
          }, (event) => {
            if (onerror) {
              onerror();
            } else {
              throw `Loading data file "${url}" failed.`;
            }
          });
          if (dep) addRunDependency(dep);
        };
        var FS_createDataFile = (parent, name, fileData, canRead, canWrite, canOwn) => {
          FS.createDataFile(parent, name, fileData, canRead, canWrite, canOwn);
        };
        var preloadPlugins = Module2["preloadPlugins"] || [];
        var FS_handledByPreloadPlugin = (byteArray, fullname, finish, onerror) => {
          if (typeof Browser != "undefined") Browser.init();
          var handled = false;
          preloadPlugins.forEach((plugin) => {
            if (handled) return;
            if (plugin["canHandle"](fullname)) {
              plugin["handle"](byteArray, fullname, finish, onerror);
              handled = true;
            }
          });
          return handled;
        };
        var FS_createPreloadedFile = (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) => {
          var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
          var dep = getUniqueRunDependency(`cp ${fullname}`);
          function processData(byteArray) {
            function finish(byteArray2) {
              preFinish?.();
              if (!dontCreateFile) {
                FS_createDataFile(parent, name, byteArray2, canRead, canWrite, canOwn);
              }
              onload?.();
              removeRunDependency(dep);
            }
            if (FS_handledByPreloadPlugin(byteArray, fullname, finish, () => {
              onerror?.();
              removeRunDependency(dep);
            })) {
              return;
            }
            finish(byteArray);
          }
          addRunDependency(dep);
          if (typeof url == "string") {
            asyncLoad(url, (byteArray) => processData(byteArray), onerror);
          } else {
            processData(url);
          }
        };
        var FS_modeStringToFlags = (str) => {
          var flagModes = { "r": 0, "r+": 2, "w": 512 | 64 | 1, "w+": 512 | 64 | 2, "a": 1024 | 64 | 1, "a+": 1024 | 64 | 2 };
          var flags = flagModes[str];
          if (typeof flags == "undefined") {
            throw new Error(`Unknown file open mode: ${str}`);
          }
          return flags;
        };
        var FS_getMode = (canRead, canWrite) => {
          var mode = 0;
          if (canRead) mode |= 292 | 73;
          if (canWrite) mode |= 146;
          return mode;
        };
        var ERRNO_CODES = { "EPERM": 63, "ENOENT": 44, "ESRCH": 71, "EINTR": 27, "EIO": 29, "ENXIO": 60, "E2BIG": 1, "ENOEXEC": 45, "EBADF": 8, "ECHILD": 12, "EAGAIN": 6, "EWOULDBLOCK": 6, "ENOMEM": 48, "EACCES": 2, "EFAULT": 21, "ENOTBLK": 105, "EBUSY": 10, "EEXIST": 20, "EXDEV": 75, "ENODEV": 43, "ENOTDIR": 54, "EISDIR": 31, "EINVAL": 28, "ENFILE": 41, "EMFILE": 33, "ENOTTY": 59, "ETXTBSY": 74, "EFBIG": 22, "ENOSPC": 51, "ESPIPE": 70, "EROFS": 69, "EMLINK": 34, "EPIPE": 64, "EDOM": 18, "ERANGE": 68, "ENOMSG": 49, "EIDRM": 24, "ECHRNG": 106, "EL2NSYNC": 156, "EL3HLT": 107, "EL3RST": 108, "ELNRNG": 109, "EUNATCH": 110, "ENOCSI": 111, "EL2HLT": 112, "EDEADLK": 16, "ENOLCK": 46, "EBADE": 113, "EBADR": 114, "EXFULL": 115, "ENOANO": 104, "EBADRQC": 103, "EBADSLT": 102, "EDEADLOCK": 16, "EBFONT": 101, "ENOSTR": 100, "ENODATA": 116, "ETIME": 117, "ENOSR": 118, "ENONET": 119, "ENOPKG": 120, "EREMOTE": 121, "ENOLINK": 47, "EADV": 122, "ESRMNT": 123, "ECOMM": 124, "EPROTO": 65, "EMULTIHOP": 36, "EDOTDOT": 125, "EBADMSG": 9, "ENOTUNIQ": 126, "EBADFD": 127, "EREMCHG": 128, "ELIBACC": 129, "ELIBBAD": 130, "ELIBSCN": 131, "ELIBMAX": 132, "ELIBEXEC": 133, "ENOSYS": 52, "ENOTEMPTY": 55, "ENAMETOOLONG": 37, "ELOOP": 32, "EOPNOTSUPP": 138, "EPFNOSUPPORT": 139, "ECONNRESET": 15, "ENOBUFS": 42, "EAFNOSUPPORT": 5, "EPROTOTYPE": 67, "ENOTSOCK": 57, "ENOPROTOOPT": 50, "ESHUTDOWN": 140, "ECONNREFUSED": 14, "EADDRINUSE": 3, "ECONNABORTED": 13, "ENETUNREACH": 40, "ENETDOWN": 38, "ETIMEDOUT": 73, "EHOSTDOWN": 142, "EHOSTUNREACH": 23, "EINPROGRESS": 26, "EALREADY": 7, "EDESTADDRREQ": 17, "EMSGSIZE": 35, "EPROTONOSUPPORT": 66, "ESOCKTNOSUPPORT": 137, "EADDRNOTAVAIL": 4, "ENETRESET": 39, "EISCONN": 30, "ENOTCONN": 53, "ETOOMANYREFS": 141, "EUSERS": 136, "EDQUOT": 19, "ESTALE": 72, "ENOTSUP": 138, "ENOMEDIUM": 148, "EILSEQ": 25, "EOVERFLOW": 61, "ECANCELED": 11, "ENOTRECOVERABLE": 56, "EOWNERDEAD": 62, "ESTRPIPE": 135 };
        var NODEFS = { isWindows: false, staticInit() {
          NODEFS.isWindows = !!process.platform.match(/^win/);
          var flags = process.binding("constants");
          if (flags["fs"]) {
            flags = flags["fs"];
          }
          NODEFS.flagsForNodeMap = { 1024: flags["O_APPEND"], 64: flags["O_CREAT"], 128: flags["O_EXCL"], 256: flags["O_NOCTTY"], 0: flags["O_RDONLY"], 2: flags["O_RDWR"], 4096: flags["O_SYNC"], 512: flags["O_TRUNC"], 1: flags["O_WRONLY"], 131072: flags["O_NOFOLLOW"] };
        }, convertNodeCode(e) {
          var code = e.code;
          return ERRNO_CODES[code];
        }, mount(mount) {
          return NODEFS.createNode(null, "/", NODEFS.getMode(mount.opts.root), 0);
        }, createNode(parent, name, mode, dev) {
          if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
            throw new FS.ErrnoError(28);
          }
          var node = FS.createNode(parent, name, mode);
          node.node_ops = NODEFS.node_ops;
          node.stream_ops = NODEFS.stream_ops;
          return node;
        }, getMode(path4) {
          var stat;
          try {
            stat = fs2.lstatSync(path4);
            if (NODEFS.isWindows) {
              stat.mode = stat.mode | (stat.mode & 292) >> 2;
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
          }
          return stat.mode;
        }, realPath(node) {
          var parts = [];
          while (node.parent !== node) {
            parts.push(node.name);
            node = node.parent;
          }
          parts.push(node.mount.opts.root);
          parts.reverse();
          return PATH.join.apply(null, parts);
        }, flagsForNode(flags) {
          flags &= ~2097152;
          flags &= ~2048;
          flags &= ~32768;
          flags &= ~524288;
          flags &= ~65536;
          var newFlags = 0;
          for (var k in NODEFS.flagsForNodeMap) {
            if (flags & k) {
              newFlags |= NODEFS.flagsForNodeMap[k];
              flags ^= k;
            }
          }
          if (flags) {
            throw new FS.ErrnoError(28);
          }
          return newFlags;
        }, node_ops: { getattr(node) {
          var path4 = NODEFS.realPath(node);
          var stat;
          try {
            stat = fs2.lstatSync(path4);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
          }
          if (NODEFS.isWindows && !stat.blksize) {
            stat.blksize = 4096;
          }
          if (NODEFS.isWindows && !stat.blocks) {
            stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0;
          }
          return { dev: stat.dev, ino: stat.ino, mode: stat.mode, nlink: stat.nlink, uid: stat.uid, gid: stat.gid, rdev: stat.rdev, size: stat.size, atime: stat.atime, mtime: stat.mtime, ctime: stat.ctime, blksize: stat.blksize, blocks: stat.blocks };
        }, setattr(node, attr) {
          var path4 = NODEFS.realPath(node);
          try {
            if (attr.mode !== void 0) {
              fs2.chmodSync(path4, attr.mode);
              node.mode = attr.mode;
            }
            if (attr.timestamp !== void 0) {
              var date = new Date(attr.timestamp);
              fs2.utimesSync(path4, date, date);
            }
            if (attr.size !== void 0) {
              fs2.truncateSync(path4, attr.size);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
          }
        }, lookup(parent, name) {
          var path4 = PATH.join2(NODEFS.realPath(parent), name);
          var mode = NODEFS.getMode(path4);
          return NODEFS.createNode(parent, name, mode);
        }, mknod(parent, name, mode, dev) {
          var node = NODEFS.createNode(parent, name, mode, dev);
          var path4 = NODEFS.realPath(node);
          try {
            if (FS.isDir(node.mode)) {
              fs2.mkdirSync(path4, node.mode);
            } else {
              fs2.writeFileSync(path4, "", { mode: node.mode });
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
          }
          return node;
        }, rename(oldNode, newDir, newName) {
          var oldPath = NODEFS.realPath(oldNode);
          var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
          try {
            fs2.renameSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
          }
          oldNode.name = newName;
        }, unlink(parent, name) {
          var path4 = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs2.unlinkSync(path4);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
          }
        }, rmdir(parent, name) {
          var path4 = PATH.join2(NODEFS.realPath(parent), name);
          try {
            fs2.rmdirSync(path4);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
          }
        }, readdir(node) {
          var path4 = NODEFS.realPath(node);
          try {
            return fs2.readdirSync(path4);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
          }
        }, symlink(parent, newName, oldPath) {
          var newPath = PATH.join2(NODEFS.realPath(parent), newName);
          try {
            fs2.symlinkSync(oldPath, newPath);
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
          }
        }, readlink(node) {
          var path4 = NODEFS.realPath(node);
          try {
            path4 = fs2.readlinkSync(path4);
            path4 = nodePath.relative(nodePath.resolve(node.mount.opts.root), path4);
            return path4;
          } catch (e) {
            if (!e.code) throw e;
            if (e.code === "UNKNOWN") throw new FS.ErrnoError(28);
            throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
          }
        } }, stream_ops: { open(stream) {
          var path4 = NODEFS.realPath(stream.node);
          try {
            if (FS.isFile(stream.node.mode)) {
              stream.nfd = fs2.openSync(path4, NODEFS.flagsForNode(stream.flags));
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
          }
        }, close(stream) {
          try {
            if (FS.isFile(stream.node.mode) && stream.nfd) {
              fs2.closeSync(stream.nfd);
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
          }
        }, read(stream, buffer, offset, length, position) {
          if (length === 0) return 0;
          try {
            return fs2.readSync(stream.nfd, new Int8Array(buffer.buffer, offset, length), { position });
          } catch (e) {
            throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
          }
        }, write(stream, buffer, offset, length, position) {
          try {
            return fs2.writeSync(stream.nfd, new Int8Array(buffer.buffer, offset, length), { position });
          } catch (e) {
            throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
          }
        }, llseek(stream, offset, whence) {
          var position = offset;
          if (whence === 1) {
            position += stream.position;
          } else if (whence === 2) {
            if (FS.isFile(stream.node.mode)) {
              try {
                var stat = fs2.fstatSync(stream.nfd);
                position += stat.size;
              } catch (e) {
                throw new FS.ErrnoError(NODEFS.convertNodeCode(e));
              }
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(28);
          }
          return position;
        }, mmap(stream, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          var ptr = mmapAlloc(length);
          NODEFS.stream_ops.read(stream, HEAP8, ptr, length, position);
          return { ptr, allocated: true };
        }, msync(stream, buffer, offset, length, mmapFlags) {
          NODEFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          return 0;
        } } };
        var NODERAWFS = { lookup(parent, name) {
          return FS.lookupPath(`${parent.path}/${name}`).node;
        }, lookupPath(path4, opts = {}) {
          if (opts.parent) {
            path4 = nodePath.dirname(path4);
          }
          var st = fs2.lstatSync(path4);
          var mode = NODEFS.getMode(path4);
          return { path: path4, node: { id: st.ino, mode, node_ops: NODERAWFS, path: path4 } };
        }, createStandardStreams() {
          FS.createStream({ nfd: 0, position: 0, path: "", flags: 0, tty: true, seekable: false }, 0);
          for (var i = 1; i < 3; i++) {
            FS.createStream({ nfd: i, position: 0, path: "", flags: 577, tty: true, seekable: false }, i);
          }
        }, cwd() {
          return process.cwd();
        }, chdir() {
          process.chdir.apply(void 0, arguments);
        }, mknod(path4, mode) {
          if (FS.isDir(path4)) {
            fs2.mkdirSync(path4, mode);
          } else {
            fs2.writeFileSync(path4, "", { mode });
          }
        }, mkdir() {
          fs2.mkdirSync.apply(void 0, arguments);
        }, symlink() {
          fs2.symlinkSync.apply(void 0, arguments);
        }, rename() {
          fs2.renameSync.apply(void 0, arguments);
        }, rmdir() {
          fs2.rmdirSync.apply(void 0, arguments);
        }, readdir() {
          return [".", ".."].concat(fs2.readdirSync.apply(void 0, arguments));
        }, unlink() {
          fs2.unlinkSync.apply(void 0, arguments);
        }, readlink() {
          return fs2.readlinkSync.apply(void 0, arguments);
        }, stat() {
          return fs2.statSync.apply(void 0, arguments);
        }, lstat() {
          return fs2.lstatSync.apply(void 0, arguments);
        }, chmod() {
          fs2.chmodSync.apply(void 0, arguments);
        }, fchmod(fd, mode) {
          var stream = FS.getStreamChecked(fd);
          fs2.fchmodSync(stream.nfd, mode);
        }, chown() {
          fs2.chownSync.apply(void 0, arguments);
        }, fchown(fd, owner, group) {
          var stream = FS.getStreamChecked(fd);
          fs2.fchownSync(stream.nfd, owner, group);
        }, truncate() {
          fs2.truncateSync.apply(void 0, arguments);
        }, ftruncate(fd, len) {
          if (len < 0) {
            throw new FS.ErrnoError(28);
          }
          var stream = FS.getStreamChecked(fd);
          fs2.ftruncateSync(stream.nfd, len);
        }, utime(path4, atime, mtime) {
          fs2.utimesSync(path4, atime / 1e3, mtime / 1e3);
        }, open(path4, flags, mode) {
          if (typeof flags == "string") {
            flags = FS_modeStringToFlags(flags);
          }
          var pathTruncated = path4.split("/").map(function(s) {
            return s.substr(0, 255);
          }).join("/");
          var nfd = fs2.openSync(pathTruncated, NODEFS.flagsForNode(flags), mode);
          var st = fs2.fstatSync(nfd);
          if (flags & 65536 && !st.isDirectory()) {
            fs2.closeSync(nfd);
            throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR);
          }
          var newMode = NODEFS.getMode(pathTruncated);
          var node = { id: st.ino, mode: newMode, node_ops: NODERAWFS, path: path4 };
          return FS.createStream({ nfd, position: 0, path: path4, flags, node, seekable: true });
        }, createStream(stream, fd) {
          var rtn = VFS.createStream(stream, fd);
          if (typeof rtn.shared.refcnt == "undefined") {
            rtn.shared.refcnt = 1;
          } else {
            rtn.shared.refcnt++;
          }
          return rtn;
        }, close(stream) {
          VFS.closeStream(stream.fd);
          if (!stream.stream_ops && --stream.shared.refcnt === 0) {
            fs2.closeSync(stream.nfd);
          }
        }, llseek(stream, offset, whence) {
          if (stream.stream_ops) {
            return VFS.llseek(stream, offset, whence);
          }
          var position = offset;
          if (whence === 1) {
            position += stream.position;
          } else if (whence === 2) {
            position += fs2.fstatSync(stream.nfd).size;
          } else if (whence !== 0) {
            throw new FS.ErrnoError(28);
          }
          if (position < 0) {
            throw new FS.ErrnoError(28);
          }
          stream.position = position;
          return position;
        }, read(stream, buffer, offset, length, position) {
          if (stream.stream_ops) {
            return VFS.read(stream, buffer, offset, length, position);
          }
          var seeking = typeof position != "undefined";
          if (!seeking && stream.seekable) position = stream.position;
          var bytesRead = fs2.readSync(stream.nfd, new Int8Array(buffer.buffer, offset, length), { position });
          if (!seeking) stream.position += bytesRead;
          return bytesRead;
        }, write(stream, buffer, offset, length, position) {
          if (stream.stream_ops) {
            return VFS.write(stream, buffer, offset, length, position);
          }
          if (stream.flags & 1024) {
            FS.llseek(stream, 0, 2);
          }
          var seeking = typeof position != "undefined";
          if (!seeking && stream.seekable) position = stream.position;
          var bytesWritten = fs2.writeSync(stream.nfd, new Int8Array(buffer.buffer, offset, length), { position });
          if (!seeking) stream.position += bytesWritten;
          return bytesWritten;
        }, allocate() {
          throw new FS.ErrnoError(138);
        }, mmap(stream, length, position, prot, flags) {
          if (stream.stream_ops) {
            return VFS.mmap(stream, length, position, prot, flags);
          }
          var ptr = mmapAlloc(length);
          FS.read(stream, HEAP8, ptr, length, position);
          return { ptr, allocated: true };
        }, msync(stream, buffer, offset, length, mmapFlags) {
          if (stream.stream_ops) {
            return VFS.msync(stream, buffer, offset, length, mmapFlags);
          }
          FS.write(stream, buffer, 0, length, offset);
          return 0;
        }, munmap() {
          return 0;
        }, ioctl() {
          throw new FS.ErrnoError(59);
        } };
        var FS = { root: null, mounts: [], devices: {}, streams: [], nextInode: 1, nameTable: null, currentPath: "/", initialized: false, ignorePermissions: true, ErrnoError: null, genericErrors: {}, filesystems: null, syncFSRequests: 0, lookupPath(path4, opts = {}) {
          path4 = PATH_FS.resolve(path4);
          if (!path4) return { path: "", node: null };
          var defaults = { follow_mount: true, recurse_count: 0 };
          opts = Object.assign(defaults, opts);
          if (opts.recurse_count > 8) {
            throw new FS.ErrnoError(32);
          }
          var parts = path4.split("/").filter((p) => !!p);
          var current = FS.root;
          var current_path = "/";
          for (var i = 0; i < parts.length; i++) {
            var islast = i === parts.length - 1;
            if (islast && opts.parent) {
              break;
            }
            current = FS.lookupNode(current, parts[i]);
            current_path = PATH.join2(current_path, parts[i]);
            if (FS.isMountpoint(current)) {
              if (!islast || islast && opts.follow_mount) {
                current = current.mounted.root;
              }
            }
            if (!islast || opts.follow) {
              var count = 0;
              while (FS.isLink(current.mode)) {
                var link = FS.readlink(current_path);
                current_path = PATH_FS.resolve(PATH.dirname(current_path), link);
                var lookup = FS.lookupPath(current_path, { recurse_count: opts.recurse_count + 1 });
                current = lookup.node;
                if (count++ > 40) {
                  throw new FS.ErrnoError(32);
                }
              }
            }
          }
          return { path: current_path, node: current };
        }, getPath(node) {
          var path4;
          while (true) {
            if (FS.isRoot(node)) {
              var mount = node.mount.mountpoint;
              if (!path4) return mount;
              return mount[mount.length - 1] !== "/" ? `${mount}/${path4}` : mount + path4;
            }
            path4 = path4 ? `${node.name}/${path4}` : node.name;
            node = node.parent;
          }
        }, hashName(parentid, name) {
          var hash = 0;
          for (var i = 0; i < name.length; i++) {
            hash = (hash << 5) - hash + name.charCodeAt(i) | 0;
          }
          return (parentid + hash >>> 0) % FS.nameTable.length;
        }, hashAddNode(node) {
          var hash = FS.hashName(node.parent.id, node.name);
          node.name_next = FS.nameTable[hash];
          FS.nameTable[hash] = node;
        }, hashRemoveNode(node) {
          var hash = FS.hashName(node.parent.id, node.name);
          if (FS.nameTable[hash] === node) {
            FS.nameTable[hash] = node.name_next;
          } else {
            var current = FS.nameTable[hash];
            while (current) {
              if (current.name_next === node) {
                current.name_next = node.name_next;
                break;
              }
              current = current.name_next;
            }
          }
        }, lookupNode(parent, name) {
          var errCode = FS.mayLookup(parent);
          if (errCode) {
            throw new FS.ErrnoError(errCode, parent);
          }
          var hash = FS.hashName(parent.id, name);
          for (var node = FS.nameTable[hash]; node; node = node.name_next) {
            var nodeName = node.name;
            if (node.parent.id === parent.id && nodeName === name) {
              return node;
            }
          }
          return FS.lookup(parent, name);
        }, createNode(parent, name, mode, rdev) {
          var node = new FS.FSNode(parent, name, mode, rdev);
          FS.hashAddNode(node);
          return node;
        }, destroyNode(node) {
          FS.hashRemoveNode(node);
        }, isRoot(node) {
          return node === node.parent;
        }, isMountpoint(node) {
          return !!node.mounted;
        }, isFile(mode) {
          return (mode & 61440) === 32768;
        }, isDir(mode) {
          return (mode & 61440) === 16384;
        }, isLink(mode) {
          return (mode & 61440) === 40960;
        }, isChrdev(mode) {
          return (mode & 61440) === 8192;
        }, isBlkdev(mode) {
          return (mode & 61440) === 24576;
        }, isFIFO(mode) {
          return (mode & 61440) === 4096;
        }, isSocket(mode) {
          return (mode & 49152) === 49152;
        }, flagsToPermissionString(flag) {
          var perms = ["r", "w", "rw"][flag & 3];
          if (flag & 512) {
            perms += "w";
          }
          return perms;
        }, nodePermissions(node, perms) {
          if (FS.ignorePermissions) {
            return 0;
          }
          if (perms.includes("r") && !(node.mode & 292)) {
            return 2;
          } else if (perms.includes("w") && !(node.mode & 146)) {
            return 2;
          } else if (perms.includes("x") && !(node.mode & 73)) {
            return 2;
          }
          return 0;
        }, mayLookup(dir) {
          var errCode = FS.nodePermissions(dir, "x");
          if (errCode) return errCode;
          if (!dir.node_ops.lookup) return 2;
          return 0;
        }, mayCreate(dir, name) {
          try {
            var node = FS.lookupNode(dir, name);
            return 20;
          } catch (e) {
          }
          return FS.nodePermissions(dir, "wx");
        }, mayDelete(dir, name, isdir) {
          var node;
          try {
            node = FS.lookupNode(dir, name);
          } catch (e) {
            return e.errno;
          }
          var errCode = FS.nodePermissions(dir, "wx");
          if (errCode) {
            return errCode;
          }
          if (isdir) {
            if (!FS.isDir(node.mode)) {
              return 54;
            }
            if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
              return 10;
            }
          } else {
            if (FS.isDir(node.mode)) {
              return 31;
            }
          }
          return 0;
        }, mayOpen(node, flags) {
          if (!node) {
            return 44;
          }
          if (FS.isLink(node.mode)) {
            return 32;
          } else if (FS.isDir(node.mode)) {
            if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
              return 31;
            }
          }
          return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
        }, MAX_OPEN_FDS: 4096, nextfd() {
          for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
            if (!FS.streams[fd]) {
              return fd;
            }
          }
          throw new FS.ErrnoError(33);
        }, getStreamChecked(fd) {
          var stream = FS.getStream(fd);
          if (!stream) {
            throw new FS.ErrnoError(8);
          }
          return stream;
        }, getStream: (fd) => FS.streams[fd], createStream(stream, fd = -1) {
          if (!FS.FSStream) {
            FS.FSStream = function() {
              this.shared = {};
            };
            FS.FSStream.prototype = {};
            Object.defineProperties(FS.FSStream.prototype, { object: { get() {
              return this.node;
            }, set(val) {
              this.node = val;
            } }, isRead: { get() {
              return (this.flags & 2097155) !== 1;
            } }, isWrite: { get() {
              return (this.flags & 2097155) !== 0;
            } }, isAppend: { get() {
              return this.flags & 1024;
            } }, flags: { get() {
              return this.shared.flags;
            }, set(val) {
              this.shared.flags = val;
            } }, position: { get() {
              return this.shared.position;
            }, set(val) {
              this.shared.position = val;
            } } });
          }
          stream = Object.assign(new FS.FSStream(), stream);
          if (fd == -1) {
            fd = FS.nextfd();
          }
          stream.fd = fd;
          FS.streams[fd] = stream;
          return stream;
        }, closeStream(fd) {
          FS.streams[fd] = null;
        }, chrdev_stream_ops: { open(stream) {
          var device = FS.getDevice(stream.node.rdev);
          stream.stream_ops = device.stream_ops;
          stream.stream_ops.open?.(stream);
        }, llseek() {
          throw new FS.ErrnoError(70);
        } }, major: (dev) => dev >> 8, minor: (dev) => dev & 255, makedev: (ma, mi) => ma << 8 | mi, registerDevice(dev, ops) {
          FS.devices[dev] = { stream_ops: ops };
        }, getDevice: (dev) => FS.devices[dev], getMounts(mount) {
          var mounts = [];
          var check = [mount];
          while (check.length) {
            var m = check.pop();
            mounts.push(m);
            check.push.apply(check, m.mounts);
          }
          return mounts;
        }, syncfs(populate, callback) {
          if (typeof populate == "function") {
            callback = populate;
            populate = false;
          }
          FS.syncFSRequests++;
          if (FS.syncFSRequests > 1) {
            err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
          }
          var mounts = FS.getMounts(FS.root.mount);
          var completed = 0;
          function doCallback(errCode) {
            FS.syncFSRequests--;
            return callback(errCode);
          }
          function done(errCode) {
            if (errCode) {
              if (!done.errored) {
                done.errored = true;
                return doCallback(errCode);
              }
              return;
            }
            if (++completed >= mounts.length) {
              doCallback(null);
            }
          }
          mounts.forEach((mount) => {
            if (!mount.type.syncfs) {
              return done(null);
            }
            mount.type.syncfs(mount, populate, done);
          });
        }, mount(type, opts, mountpoint) {
          var root = mountpoint === "/";
          var pseudo = !mountpoint;
          var node;
          if (root && FS.root) {
            throw new FS.ErrnoError(10);
          } else if (!root && !pseudo) {
            var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
            mountpoint = lookup.path;
            node = lookup.node;
            if (FS.isMountpoint(node)) {
              throw new FS.ErrnoError(10);
            }
            if (!FS.isDir(node.mode)) {
              throw new FS.ErrnoError(54);
            }
          }
          var mount = { type, opts, mountpoint, mounts: [] };
          var mountRoot = type.mount(mount);
          mountRoot.mount = mount;
          mount.root = mountRoot;
          if (root) {
            FS.root = mountRoot;
          } else if (node) {
            node.mounted = mount;
            if (node.mount) {
              node.mount.mounts.push(mount);
            }
          }
          return mountRoot;
        }, unmount(mountpoint) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
          if (!FS.isMountpoint(lookup.node)) {
            throw new FS.ErrnoError(28);
          }
          var node = lookup.node;
          var mount = node.mounted;
          var mounts = FS.getMounts(mount);
          Object.keys(FS.nameTable).forEach((hash) => {
            var current = FS.nameTable[hash];
            while (current) {
              var next = current.name_next;
              if (mounts.includes(current.mount)) {
                FS.destroyNode(current);
              }
              current = next;
            }
          });
          node.mounted = null;
          var idx = node.mount.mounts.indexOf(mount);
          node.mount.mounts.splice(idx, 1);
        }, lookup(parent, name) {
          return parent.node_ops.lookup(parent, name);
        }, mknod(path4, mode, dev) {
          var lookup = FS.lookupPath(path4, { parent: true });
          var parent = lookup.node;
          var name = PATH.basename(path4);
          if (!name || name === "." || name === "..") {
            throw new FS.ErrnoError(28);
          }
          var errCode = FS.mayCreate(parent, name);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          if (!parent.node_ops.mknod) {
            throw new FS.ErrnoError(63);
          }
          return parent.node_ops.mknod(parent, name, mode, dev);
        }, create(path4, mode) {
          mode = mode !== void 0 ? mode : 438;
          mode &= 4095;
          mode |= 32768;
          return FS.mknod(path4, mode, 0);
        }, mkdir(path4, mode) {
          mode = mode !== void 0 ? mode : 511;
          mode &= 511 | 512;
          mode |= 16384;
          return FS.mknod(path4, mode, 0);
        }, mkdirTree(path4, mode) {
          var dirs = path4.split("/");
          var d = "";
          for (var i = 0; i < dirs.length; ++i) {
            if (!dirs[i]) continue;
            d += "/" + dirs[i];
            try {
              FS.mkdir(d, mode);
            } catch (e) {
              if (e.errno != 20) throw e;
            }
          }
        }, mkdev(path4, mode, dev) {
          if (typeof dev == "undefined") {
            dev = mode;
            mode = 438;
          }
          mode |= 8192;
          return FS.mknod(path4, mode, dev);
        }, symlink(oldpath, newpath) {
          if (!PATH_FS.resolve(oldpath)) {
            throw new FS.ErrnoError(44);
          }
          var lookup = FS.lookupPath(newpath, { parent: true });
          var parent = lookup.node;
          if (!parent) {
            throw new FS.ErrnoError(44);
          }
          var newname = PATH.basename(newpath);
          var errCode = FS.mayCreate(parent, newname);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          if (!parent.node_ops.symlink) {
            throw new FS.ErrnoError(63);
          }
          return parent.node_ops.symlink(parent, newname, oldpath);
        }, rename(old_path, new_path) {
          var old_dirname = PATH.dirname(old_path);
          var new_dirname = PATH.dirname(new_path);
          var old_name = PATH.basename(old_path);
          var new_name = PATH.basename(new_path);
          var lookup, old_dir, new_dir;
          lookup = FS.lookupPath(old_path, { parent: true });
          old_dir = lookup.node;
          lookup = FS.lookupPath(new_path, { parent: true });
          new_dir = lookup.node;
          if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
          if (old_dir.mount !== new_dir.mount) {
            throw new FS.ErrnoError(75);
          }
          var old_node = FS.lookupNode(old_dir, old_name);
          var relative = PATH_FS.relative(old_path, new_dirname);
          if (relative.charAt(0) !== ".") {
            throw new FS.ErrnoError(28);
          }
          relative = PATH_FS.relative(new_path, old_dirname);
          if (relative.charAt(0) !== ".") {
            throw new FS.ErrnoError(55);
          }
          var new_node;
          try {
            new_node = FS.lookupNode(new_dir, new_name);
          } catch (e) {
          }
          if (old_node === new_node) {
            return;
          }
          var isdir = FS.isDir(old_node.mode);
          var errCode = FS.mayDelete(old_dir, old_name, isdir);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          errCode = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          if (!old_dir.node_ops.rename) {
            throw new FS.ErrnoError(63);
          }
          if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
            throw new FS.ErrnoError(10);
          }
          if (new_dir !== old_dir) {
            errCode = FS.nodePermissions(old_dir, "w");
            if (errCode) {
              throw new FS.ErrnoError(errCode);
            }
          }
          FS.hashRemoveNode(old_node);
          try {
            old_dir.node_ops.rename(old_node, new_dir, new_name);
          } catch (e) {
            throw e;
          } finally {
            FS.hashAddNode(old_node);
          }
        }, rmdir(path4) {
          var lookup = FS.lookupPath(path4, { parent: true });
          var parent = lookup.node;
          var name = PATH.basename(path4);
          var node = FS.lookupNode(parent, name);
          var errCode = FS.mayDelete(parent, name, true);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          if (!parent.node_ops.rmdir) {
            throw new FS.ErrnoError(63);
          }
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10);
          }
          parent.node_ops.rmdir(parent, name);
          FS.destroyNode(node);
        }, readdir(path4) {
          var lookup = FS.lookupPath(path4, { follow: true });
          var node = lookup.node;
          if (!node.node_ops.readdir) {
            throw new FS.ErrnoError(54);
          }
          return node.node_ops.readdir(node);
        }, unlink(path4) {
          var lookup = FS.lookupPath(path4, { parent: true });
          var parent = lookup.node;
          if (!parent) {
            throw new FS.ErrnoError(44);
          }
          var name = PATH.basename(path4);
          var node = FS.lookupNode(parent, name);
          var errCode = FS.mayDelete(parent, name, false);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          if (!parent.node_ops.unlink) {
            throw new FS.ErrnoError(63);
          }
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10);
          }
          parent.node_ops.unlink(parent, name);
          FS.destroyNode(node);
        }, readlink(path4) {
          var lookup = FS.lookupPath(path4);
          var link = lookup.node;
          if (!link) {
            throw new FS.ErrnoError(44);
          }
          if (!link.node_ops.readlink) {
            throw new FS.ErrnoError(28);
          }
          return PATH_FS.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
        }, stat(path4, dontFollow) {
          var lookup = FS.lookupPath(path4, { follow: !dontFollow });
          var node = lookup.node;
          if (!node) {
            throw new FS.ErrnoError(44);
          }
          if (!node.node_ops.getattr) {
            throw new FS.ErrnoError(63);
          }
          return node.node_ops.getattr(node);
        }, lstat(path4) {
          return FS.stat(path4, true);
        }, chmod(path4, mode, dontFollow) {
          var node;
          if (typeof path4 == "string") {
            var lookup = FS.lookupPath(path4, { follow: !dontFollow });
            node = lookup.node;
          } else {
            node = path4;
          }
          if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(63);
          }
          node.node_ops.setattr(node, { mode: mode & 4095 | node.mode & ~4095, timestamp: Date.now() });
        }, lchmod(path4, mode) {
          FS.chmod(path4, mode, true);
        }, fchmod(fd, mode) {
          var stream = FS.getStreamChecked(fd);
          FS.chmod(stream.node, mode);
        }, chown(path4, uid, gid, dontFollow) {
          var node;
          if (typeof path4 == "string") {
            var lookup = FS.lookupPath(path4, { follow: !dontFollow });
            node = lookup.node;
          } else {
            node = path4;
          }
          if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(63);
          }
          node.node_ops.setattr(node, { timestamp: Date.now() });
        }, lchown(path4, uid, gid) {
          FS.chown(path4, uid, gid, true);
        }, fchown(fd, uid, gid) {
          var stream = FS.getStreamChecked(fd);
          FS.chown(stream.node, uid, gid);
        }, truncate(path4, len) {
          if (len < 0) {
            throw new FS.ErrnoError(28);
          }
          var node;
          if (typeof path4 == "string") {
            var lookup = FS.lookupPath(path4, { follow: true });
            node = lookup.node;
          } else {
            node = path4;
          }
          if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(63);
          }
          if (FS.isDir(node.mode)) {
            throw new FS.ErrnoError(31);
          }
          if (!FS.isFile(node.mode)) {
            throw new FS.ErrnoError(28);
          }
          var errCode = FS.nodePermissions(node, "w");
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          node.node_ops.setattr(node, { size: len, timestamp: Date.now() });
        }, ftruncate(fd, len) {
          var stream = FS.getStreamChecked(fd);
          if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(28);
          }
          FS.truncate(stream.node, len);
        }, utime(path4, atime, mtime) {
          var lookup = FS.lookupPath(path4, { follow: true });
          var node = lookup.node;
          node.node_ops.setattr(node, { timestamp: Math.max(atime, mtime) });
        }, open(path4, flags, mode) {
          if (path4 === "") {
            throw new FS.ErrnoError(44);
          }
          flags = typeof flags == "string" ? FS_modeStringToFlags(flags) : flags;
          mode = typeof mode == "undefined" ? 438 : mode;
          if (flags & 64) {
            mode = mode & 4095 | 32768;
          } else {
            mode = 0;
          }
          var node;
          if (typeof path4 == "object") {
            node = path4;
          } else {
            path4 = PATH.normalize(path4);
            try {
              var lookup = FS.lookupPath(path4, { follow: !(flags & 131072) });
              node = lookup.node;
            } catch (e) {
            }
          }
          var created = false;
          if (flags & 64) {
            if (node) {
              if (flags & 128) {
                throw new FS.ErrnoError(20);
              }
            } else {
              node = FS.mknod(path4, mode, 0);
              created = true;
            }
          }
          if (!node) {
            throw new FS.ErrnoError(44);
          }
          if (FS.isChrdev(node.mode)) {
            flags &= ~512;
          }
          if (flags & 65536 && !FS.isDir(node.mode)) {
            throw new FS.ErrnoError(54);
          }
          if (!created) {
            var errCode = FS.mayOpen(node, flags);
            if (errCode) {
              throw new FS.ErrnoError(errCode);
            }
          }
          if (flags & 512 && !created) {
            FS.truncate(node, 0);
          }
          flags &= ~(128 | 512 | 131072);
          var stream = FS.createStream({ node, path: FS.getPath(node), flags, seekable: true, position: 0, stream_ops: node.stream_ops, ungotten: [], error: false });
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream);
          }
          if (Module2["logReadFiles"] && !(flags & 1)) {
            if (!FS.readFiles) FS.readFiles = {};
            if (!(path4 in FS.readFiles)) {
              FS.readFiles[path4] = 1;
            }
          }
          return stream;
        }, close(stream) {
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8);
          }
          if (stream.getdents) stream.getdents = null;
          try {
            if (stream.stream_ops.close) {
              stream.stream_ops.close(stream);
            }
          } catch (e) {
            throw e;
          } finally {
            FS.closeStream(stream.fd);
          }
          stream.fd = null;
        }, isClosed(stream) {
          return stream.fd === null;
        }, llseek(stream, offset, whence) {
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8);
          }
          if (!stream.seekable || !stream.stream_ops.llseek) {
            throw new FS.ErrnoError(70);
          }
          if (whence != 0 && whence != 1 && whence != 2) {
            throw new FS.ErrnoError(28);
          }
          stream.position = stream.stream_ops.llseek(stream, offset, whence);
          stream.ungotten = [];
          return stream.position;
        }, read(stream, buffer, offset, length, position) {
          if (length < 0 || position < 0) {
            throw new FS.ErrnoError(28);
          }
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8);
          }
          if ((stream.flags & 2097155) === 1) {
            throw new FS.ErrnoError(8);
          }
          if (FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(31);
          }
          if (!stream.stream_ops.read) {
            throw new FS.ErrnoError(28);
          }
          var seeking = typeof position != "undefined";
          if (!seeking) {
            position = stream.position;
          } else if (!stream.seekable) {
            throw new FS.ErrnoError(70);
          }
          var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
          if (!seeking) stream.position += bytesRead;
          return bytesRead;
        }, write(stream, buffer, offset, length, position, canOwn) {
          if (length < 0 || position < 0) {
            throw new FS.ErrnoError(28);
          }
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8);
          }
          if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(8);
          }
          if (FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(31);
          }
          if (!stream.stream_ops.write) {
            throw new FS.ErrnoError(28);
          }
          if (stream.seekable && stream.flags & 1024) {
            FS.llseek(stream, 0, 2);
          }
          var seeking = typeof position != "undefined";
          if (!seeking) {
            position = stream.position;
          } else if (!stream.seekable) {
            throw new FS.ErrnoError(70);
          }
          var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
          if (!seeking) stream.position += bytesWritten;
          return bytesWritten;
        }, allocate(stream, offset, length) {
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(8);
          }
          if (offset < 0 || length <= 0) {
            throw new FS.ErrnoError(28);
          }
          if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(8);
          }
          if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          if (!stream.stream_ops.allocate) {
            throw new FS.ErrnoError(138);
          }
          stream.stream_ops.allocate(stream, offset, length);
        }, mmap(stream, length, position, prot, flags) {
          if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
            throw new FS.ErrnoError(2);
          }
          if ((stream.flags & 2097155) === 1) {
            throw new FS.ErrnoError(2);
          }
          if (!stream.stream_ops.mmap) {
            throw new FS.ErrnoError(43);
          }
          return stream.stream_ops.mmap(stream, length, position, prot, flags);
        }, msync(stream, buffer, offset, length, mmapFlags) {
          if (!stream.stream_ops.msync) {
            return 0;
          }
          return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
        }, munmap: (stream) => 0, ioctl(stream, cmd, arg) {
          if (!stream.stream_ops.ioctl) {
            throw new FS.ErrnoError(59);
          }
          return stream.stream_ops.ioctl(stream, cmd, arg);
        }, readFile(path4, opts = {}) {
          opts.flags = opts.flags || 0;
          opts.encoding = opts.encoding || "binary";
          if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
            throw new Error(`Invalid encoding type "${opts.encoding}"`);
          }
          var ret;
          var stream = FS.open(path4, opts.flags);
          var stat = FS.stat(path4);
          var length = stat.size;
          var buf = new Uint8Array(length);
          FS.read(stream, buf, 0, length, 0);
          if (opts.encoding === "utf8") {
            ret = UTF8ArrayToString(buf, 0);
          } else if (opts.encoding === "binary") {
            ret = buf;
          }
          FS.close(stream);
          return ret;
        }, writeFile(path4, data, opts = {}) {
          opts.flags = opts.flags || 577;
          var stream = FS.open(path4, opts.flags, opts.mode);
          if (typeof data == "string") {
            var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
            var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
            FS.write(stream, buf, 0, actualNumBytes, void 0, opts.canOwn);
          } else if (ArrayBuffer.isView(data)) {
            FS.write(stream, data, 0, data.byteLength, void 0, opts.canOwn);
          } else {
            throw new Error("Unsupported data type");
          }
          FS.close(stream);
        }, cwd: () => FS.currentPath, chdir(path4) {
          var lookup = FS.lookupPath(path4, { follow: true });
          if (lookup.node === null) {
            throw new FS.ErrnoError(44);
          }
          if (!FS.isDir(lookup.node.mode)) {
            throw new FS.ErrnoError(54);
          }
          var errCode = FS.nodePermissions(lookup.node, "x");
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
          FS.currentPath = lookup.path;
        }, createDefaultDirectories() {
          FS.mkdir("/tmp");
          FS.mkdir("/home");
          FS.mkdir("/home/web_user");
        }, createDefaultDevices() {
          FS.mkdir("/dev");
          FS.registerDevice(FS.makedev(1, 3), { read: () => 0, write: (stream, buffer, offset, length, pos) => length });
          FS.mkdev("/dev/null", FS.makedev(1, 3));
          TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
          TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
          FS.mkdev("/dev/tty", FS.makedev(5, 0));
          FS.mkdev("/dev/tty1", FS.makedev(6, 0));
          var randomBuffer = new Uint8Array(1024), randomLeft = 0;
          var randomByte = () => {
            if (randomLeft === 0) {
              randomLeft = randomFill(randomBuffer).byteLength;
            }
            return randomBuffer[--randomLeft];
          };
          FS.createDevice("/dev", "random", randomByte);
          FS.createDevice("/dev", "urandom", randomByte);
          FS.mkdir("/dev/shm");
          FS.mkdir("/dev/shm/tmp");
        }, createSpecialDirectories() {
          FS.mkdir("/proc");
          var proc_self = FS.mkdir("/proc/self");
          FS.mkdir("/proc/self/fd");
          FS.mount({ mount() {
            var node = FS.createNode(proc_self, "fd", 16384 | 511, 73);
            node.node_ops = { lookup(parent, name) {
              var fd = +name;
              var stream = FS.getStreamChecked(fd);
              var ret = { parent: null, mount: { mountpoint: "fake" }, node_ops: { readlink: () => stream.path } };
              ret.parent = ret;
              return ret;
            } };
            return node;
          } }, {}, "/proc/self/fd");
        }, createStandardStreams() {
          if (Module2["stdin"]) {
            FS.createDevice("/dev", "stdin", Module2["stdin"]);
          } else {
            FS.symlink("/dev/tty", "/dev/stdin");
          }
          if (Module2["stdout"]) {
            FS.createDevice("/dev", "stdout", null, Module2["stdout"]);
          } else {
            FS.symlink("/dev/tty", "/dev/stdout");
          }
          if (Module2["stderr"]) {
            FS.createDevice("/dev", "stderr", null, Module2["stderr"]);
          } else {
            FS.symlink("/dev/tty1", "/dev/stderr");
          }
          var stdin = FS.open("/dev/stdin", 0);
          var stdout = FS.open("/dev/stdout", 1);
          var stderr = FS.open("/dev/stderr", 1);
        }, ensureErrnoError() {
          if (FS.ErrnoError) return;
          FS.ErrnoError = function ErrnoError(errno, node) {
            this.name = "ErrnoError";
            this.node = node;
            this.setErrno = function(errno2) {
              this.errno = errno2;
            };
            this.setErrno(errno);
            this.message = "FS error";
          };
          FS.ErrnoError.prototype = new Error();
          FS.ErrnoError.prototype.constructor = FS.ErrnoError;
          [44].forEach((code) => {
            FS.genericErrors[code] = new FS.ErrnoError(code);
            FS.genericErrors[code].stack = "<generic error, no stack>";
          });
        }, staticInit() {
          FS.ensureErrnoError();
          FS.nameTable = new Array(4096);
          FS.mount(MEMFS, {}, "/");
          FS.createDefaultDirectories();
          FS.createDefaultDevices();
          FS.createSpecialDirectories();
          FS.filesystems = { "MEMFS": MEMFS, "NODEFS": NODEFS };
        }, init(input, output, error) {
          FS.init.initialized = true;
          FS.ensureErrnoError();
          Module2["stdin"] = input || Module2["stdin"];
          Module2["stdout"] = output || Module2["stdout"];
          Module2["stderr"] = error || Module2["stderr"];
          FS.createStandardStreams();
        }, quit() {
          FS.init.initialized = false;
          for (var i = 0; i < FS.streams.length; i++) {
            var stream = FS.streams[i];
            if (!stream) {
              continue;
            }
            FS.close(stream);
          }
        }, findObject(path4, dontResolveLastLink) {
          var ret = FS.analyzePath(path4, dontResolveLastLink);
          if (!ret.exists) {
            return null;
          }
          return ret.object;
        }, analyzePath(path4, dontResolveLastLink) {
          try {
            var lookup = FS.lookupPath(path4, { follow: !dontResolveLastLink });
            path4 = lookup.path;
          } catch (e) {
          }
          var ret = { isRoot: false, exists: false, error: 0, name: null, path: null, object: null, parentExists: false, parentPath: null, parentObject: null };
          try {
            var lookup = FS.lookupPath(path4, { parent: true });
            ret.parentExists = true;
            ret.parentPath = lookup.path;
            ret.parentObject = lookup.node;
            ret.name = PATH.basename(path4);
            lookup = FS.lookupPath(path4, { follow: !dontResolveLastLink });
            ret.exists = true;
            ret.path = lookup.path;
            ret.object = lookup.node;
            ret.name = lookup.node.name;
            ret.isRoot = lookup.path === "/";
          } catch (e) {
            ret.error = e.errno;
          }
          return ret;
        }, createPath(parent, path4, canRead, canWrite) {
          parent = typeof parent == "string" ? parent : FS.getPath(parent);
          var parts = path4.split("/").reverse();
          while (parts.length) {
            var part = parts.pop();
            if (!part) continue;
            var current = PATH.join2(parent, part);
            try {
              FS.mkdir(current);
            } catch (e) {
            }
            parent = current;
          }
          return current;
        }, createFile(parent, name, properties, canRead, canWrite) {
          var path4 = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name);
          var mode = FS_getMode(canRead, canWrite);
          return FS.create(path4, mode);
        }, createDataFile(parent, name, data, canRead, canWrite, canOwn) {
          var path4 = name;
          if (parent) {
            parent = typeof parent == "string" ? parent : FS.getPath(parent);
            path4 = name ? PATH.join2(parent, name) : parent;
          }
          var mode = FS_getMode(canRead, canWrite);
          var node = FS.create(path4, mode);
          if (data) {
            if (typeof data == "string") {
              var arr = new Array(data.length);
              for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
              data = arr;
            }
            FS.chmod(node, mode | 146);
            var stream = FS.open(node, 577);
            FS.write(stream, data, 0, data.length, 0, canOwn);
            FS.close(stream);
            FS.chmod(node, mode);
          }
        }, createDevice(parent, name, input, output) {
          var path4 = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name);
          var mode = FS_getMode(!!input, !!output);
          if (!FS.createDevice.major) FS.createDevice.major = 64;
          var dev = FS.makedev(FS.createDevice.major++, 0);
          FS.registerDevice(dev, { open(stream) {
            stream.seekable = false;
          }, close(stream) {
            if (output?.buffer?.length) {
              output(10);
            }
          }, read(stream, buffer, offset, length, pos) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
              if (result === void 0 && bytesRead === 0) {
                throw new FS.ErrnoError(6);
              }
              if (result === null || result === void 0) break;
              bytesRead++;
              buffer[offset + i] = result;
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now();
            }
            return bytesRead;
          }, write(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset + i]);
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
            }
            if (length) {
              stream.node.timestamp = Date.now();
            }
            return i;
          } });
          return FS.mkdev(path4, mode, dev);
        }, forceLoadFile(obj) {
          if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
          if (typeof XMLHttpRequest != "undefined") {
            throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
          } else if (read_) {
            try {
              obj.contents = intArrayFromString(read_(obj.url), true);
              obj.usedBytes = obj.contents.length;
            } catch (e) {
              throw new FS.ErrnoError(29);
            }
          } else {
            throw new Error("Cannot load without read() or XMLHttpRequest.");
          }
        }, createLazyFile(parent, name, url, canRead, canWrite) {
          function LazyUint8Array() {
            this.lengthKnown = false;
            this.chunks = [];
          }
          LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
            if (idx > this.length - 1 || idx < 0) {
              return void 0;
            }
            var chunkOffset = idx % this.chunkSize;
            var chunkNum = idx / this.chunkSize | 0;
            return this.getter(chunkNum)[chunkOffset];
          };
          LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
            this.getter = getter;
          };
          LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
            var xhr = new XMLHttpRequest();
            xhr.open("HEAD", url, false);
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            var datalength = Number(xhr.getResponseHeader("Content-length"));
            var header;
            var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
            var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
            var chunkSize = 1024 * 1024;
            if (!hasByteServing) chunkSize = datalength;
            var doXHR = (from, to) => {
              if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
              if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
              var xhr2 = new XMLHttpRequest();
              xhr2.open("GET", url, false);
              if (datalength !== chunkSize) xhr2.setRequestHeader("Range", "bytes=" + from + "-" + to);
              xhr2.responseType = "arraybuffer";
              if (xhr2.overrideMimeType) {
                xhr2.overrideMimeType("text/plain; charset=x-user-defined");
              }
              xhr2.send(null);
              if (!(xhr2.status >= 200 && xhr2.status < 300 || xhr2.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr2.status);
              if (xhr2.response !== void 0) {
                return new Uint8Array(xhr2.response || []);
              }
              return intArrayFromString(xhr2.responseText || "", true);
            };
            var lazyArray2 = this;
            lazyArray2.setDataGetter((chunkNum) => {
              var start = chunkNum * chunkSize;
              var end = (chunkNum + 1) * chunkSize - 1;
              end = Math.min(end, datalength - 1);
              if (typeof lazyArray2.chunks[chunkNum] == "undefined") {
                lazyArray2.chunks[chunkNum] = doXHR(start, end);
              }
              if (typeof lazyArray2.chunks[chunkNum] == "undefined") throw new Error("doXHR failed!");
              return lazyArray2.chunks[chunkNum];
            });
            if (usesGzip || !datalength) {
              chunkSize = datalength = 1;
              datalength = this.getter(0).length;
              chunkSize = datalength;
              out("LazyFiles on gzip forces download of the whole file when length is accessed");
            }
            this._length = datalength;
            this._chunkSize = chunkSize;
            this.lengthKnown = true;
          };
          if (typeof XMLHttpRequest != "undefined") {
            if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
            var lazyArray = new LazyUint8Array();
            Object.defineProperties(lazyArray, { length: { get: function() {
              if (!this.lengthKnown) {
                this.cacheLength();
              }
              return this._length;
            } }, chunkSize: { get: function() {
              if (!this.lengthKnown) {
                this.cacheLength();
              }
              return this._chunkSize;
            } } });
            var properties = { isDevice: false, contents: lazyArray };
          } else {
            var properties = { isDevice: false, url };
          }
          var node = FS.createFile(parent, name, properties, canRead, canWrite);
          if (properties.contents) {
            node.contents = properties.contents;
          } else if (properties.url) {
            node.contents = null;
            node.url = properties.url;
          }
          Object.defineProperties(node, { usedBytes: { get: function() {
            return this.contents.length;
          } } });
          var stream_ops = {};
          var keys = Object.keys(node.stream_ops);
          keys.forEach((key) => {
            var fn = node.stream_ops[key];
            stream_ops[key] = function forceLoadLazyFile() {
              FS.forceLoadFile(node);
              return fn.apply(null, arguments);
            };
          });
          function writeChunks(stream, buffer, offset, length, position) {
            var contents = stream.node.contents;
            if (position >= contents.length) return 0;
            var size = Math.min(contents.length - position, length);
            if (contents.slice) {
              for (var i = 0; i < size; i++) {
                buffer[offset + i] = contents[position + i];
              }
            } else {
              for (var i = 0; i < size; i++) {
                buffer[offset + i] = contents.get(position + i);
              }
            }
            return size;
          }
          stream_ops.read = (stream, buffer, offset, length, position) => {
            FS.forceLoadFile(node);
            return writeChunks(stream, buffer, offset, length, position);
          };
          stream_ops.mmap = (stream, length, position, prot, flags) => {
            FS.forceLoadFile(node);
            var ptr = mmapAlloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(48);
            }
            writeChunks(stream, HEAP8, ptr, length, position);
            return { ptr, allocated: true };
          };
          node.stream_ops = stream_ops;
          return node;
        } };
        var UTF8ToString = (ptr, maxBytesToRead) => ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
        var SYSCALLS = { DEFAULT_POLLMASK: 5, calculateAt(dirfd, path4, allowEmpty) {
          if (PATH.isAbs(path4)) {
            return path4;
          }
          var dir;
          if (dirfd === -100) {
            dir = FS.cwd();
          } else {
            var dirstream = SYSCALLS.getStreamFromFD(dirfd);
            dir = dirstream.path;
          }
          if (path4.length == 0) {
            if (!allowEmpty) {
              throw new FS.ErrnoError(44);
            }
            return dir;
          }
          return PATH.join2(dir, path4);
        }, doStat(func, path4, buf) {
          try {
            var stat = func(path4);
          } catch (e) {
            if (e && e.node && PATH.normalize(path4) !== PATH.normalize(FS.getPath(e.node))) {
              return -54;
            }
            throw e;
          }
          HEAP32[buf >> 2] = stat.dev;
          HEAP32[buf + 4 >> 2] = stat.mode;
          HEAPU32[buf + 8 >> 2] = stat.nlink;
          HEAP32[buf + 12 >> 2] = stat.uid;
          HEAP32[buf + 16 >> 2] = stat.gid;
          HEAP32[buf + 20 >> 2] = stat.rdev;
          tempI64 = [stat.size >>> 0, (tempDouble = stat.size, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[buf + 24 >> 2] = tempI64[0], HEAP32[buf + 28 >> 2] = tempI64[1];
          HEAP32[buf + 32 >> 2] = 4096;
          HEAP32[buf + 36 >> 2] = stat.blocks;
          var atime = stat.atime.getTime();
          var mtime = stat.mtime.getTime();
          var ctime = stat.ctime.getTime();
          tempI64 = [Math.floor(atime / 1e3) >>> 0, (tempDouble = Math.floor(atime / 1e3), +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[buf + 40 >> 2] = tempI64[0], HEAP32[buf + 44 >> 2] = tempI64[1];
          HEAPU32[buf + 48 >> 2] = atime % 1e3 * 1e3;
          tempI64 = [Math.floor(mtime / 1e3) >>> 0, (tempDouble = Math.floor(mtime / 1e3), +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[buf + 56 >> 2] = tempI64[0], HEAP32[buf + 60 >> 2] = tempI64[1];
          HEAPU32[buf + 64 >> 2] = mtime % 1e3 * 1e3;
          tempI64 = [Math.floor(ctime / 1e3) >>> 0, (tempDouble = Math.floor(ctime / 1e3), +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[buf + 72 >> 2] = tempI64[0], HEAP32[buf + 76 >> 2] = tempI64[1];
          HEAPU32[buf + 80 >> 2] = ctime % 1e3 * 1e3;
          tempI64 = [stat.ino >>> 0, (tempDouble = stat.ino, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[buf + 88 >> 2] = tempI64[0], HEAP32[buf + 92 >> 2] = tempI64[1];
          return 0;
        }, doMsync(addr, stream, len, flags, offset) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          if (flags & 2) {
            return 0;
          }
          var buffer = HEAPU8.slice(addr, addr + len);
          FS.msync(stream, buffer, offset, len, flags);
        }, varargs: void 0, get() {
          var ret = HEAP32[+SYSCALLS.varargs >> 2];
          SYSCALLS.varargs += 4;
          return ret;
        }, getp() {
          return SYSCALLS.get();
        }, getStr(ptr) {
          var ret = UTF8ToString(ptr);
          return ret;
        }, getStreamFromFD(fd) {
          var stream = FS.getStreamChecked(fd);
          return stream;
        } };
        function ___syscall_fcntl64(fd, cmd, varargs) {
          SYSCALLS.varargs = varargs;
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            switch (cmd) {
              case 0: {
                var arg = SYSCALLS.get();
                if (arg < 0) {
                  return -28;
                }
                while (FS.streams[arg]) {
                  arg++;
                }
                var newStream;
                newStream = FS.createStream(stream, arg);
                return newStream.fd;
              }
              case 1:
              case 2:
                return 0;
              case 3:
                return stream.flags;
              case 4: {
                var arg = SYSCALLS.get();
                stream.flags |= arg;
                return 0;
              }
              case 5: {
                var arg = SYSCALLS.getp();
                var offset = 0;
                HEAP16[arg + offset >> 1] = 2;
                return 0;
              }
              case 6:
              case 7:
                return 0;
              case 16:
              case 8:
                return -28;
              case 9:
                setErrNo(28);
                return -1;
              default: {
                return -28;
              }
            }
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
          }
        }
        function ___syscall_fstat64(fd, buf) {
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            return SYSCALLS.doStat(FS.stat, stream.path, buf);
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
          }
        }
        var stringToUTF8 = (str, outPtr, maxBytesToWrite) => stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
        function ___syscall_getcwd(buf, size) {
          try {
            if (size === 0) return -28;
            var cwd = FS.cwd();
            var cwdLengthInBytes = lengthBytesUTF8(cwd) + 1;
            if (size < cwdLengthInBytes) return -68;
            stringToUTF8(cwd, buf, size);
            return cwdLengthInBytes;
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
          }
        }
        function ___syscall_getdents64(fd, dirp, count) {
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            stream.getdents ||= FS.readdir(stream.path);
            var struct_size = 280;
            var pos = 0;
            var off = FS.llseek(stream, 0, 1);
            var idx = Math.floor(off / struct_size);
            while (idx < stream.getdents.length && pos + struct_size <= count) {
              var id;
              var type;
              var name = stream.getdents[idx];
              if (name === ".") {
                id = stream.node.id;
                type = 4;
              } else if (name === "..") {
                var lookup = FS.lookupPath(stream.path, { parent: true });
                id = lookup.node.id;
                type = 4;
              } else {
                var child = FS.lookupNode(stream.node, name);
                id = child.id;
                type = FS.isChrdev(child.mode) ? 2 : FS.isDir(child.mode) ? 4 : FS.isLink(child.mode) ? 10 : 8;
              }
              tempI64 = [id >>> 0, (tempDouble = id, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[dirp + pos >> 2] = tempI64[0], HEAP32[dirp + pos + 4 >> 2] = tempI64[1];
              tempI64 = [(idx + 1) * struct_size >>> 0, (tempDouble = (idx + 1) * struct_size, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[dirp + pos + 8 >> 2] = tempI64[0], HEAP32[dirp + pos + 12 >> 2] = tempI64[1];
              HEAP16[dirp + pos + 16 >> 1] = 280;
              HEAP8[dirp + pos + 18 >> 0] = type;
              stringToUTF8(name, dirp + pos + 19, 256);
              pos += struct_size;
              idx += 1;
            }
            FS.llseek(stream, idx * struct_size, 0);
            return pos;
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
          }
        }
        function ___syscall_ioctl(fd, op, varargs) {
          SYSCALLS.varargs = varargs;
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            switch (op) {
              case 21509: {
                if (!stream.tty) return -59;
                return 0;
              }
              case 21505: {
                if (!stream.tty) return -59;
                if (stream.tty.ops.ioctl_tcgets) {
                  var termios = stream.tty.ops.ioctl_tcgets(stream);
                  var argp = SYSCALLS.getp();
                  HEAP32[argp >> 2] = termios.c_iflag || 0;
                  HEAP32[argp + 4 >> 2] = termios.c_oflag || 0;
                  HEAP32[argp + 8 >> 2] = termios.c_cflag || 0;
                  HEAP32[argp + 12 >> 2] = termios.c_lflag || 0;
                  for (var i = 0; i < 32; i++) {
                    HEAP8[argp + i + 17 >> 0] = termios.c_cc[i] || 0;
                  }
                  return 0;
                }
                return 0;
              }
              case 21510:
              case 21511:
              case 21512: {
                if (!stream.tty) return -59;
                return 0;
              }
              case 21506:
              case 21507:
              case 21508: {
                if (!stream.tty) return -59;
                if (stream.tty.ops.ioctl_tcsets) {
                  var argp = SYSCALLS.getp();
                  var c_iflag = HEAP32[argp >> 2];
                  var c_oflag = HEAP32[argp + 4 >> 2];
                  var c_cflag = HEAP32[argp + 8 >> 2];
                  var c_lflag = HEAP32[argp + 12 >> 2];
                  var c_cc = [];
                  for (var i = 0; i < 32; i++) {
                    c_cc.push(HEAP8[argp + i + 17 >> 0]);
                  }
                  return stream.tty.ops.ioctl_tcsets(stream.tty, op, { c_iflag, c_oflag, c_cflag, c_lflag, c_cc });
                }
                return 0;
              }
              case 21519: {
                if (!stream.tty) return -59;
                var argp = SYSCALLS.getp();
                HEAP32[argp >> 2] = 0;
                return 0;
              }
              case 21520: {
                if (!stream.tty) return -59;
                return -28;
              }
              case 21531: {
                var argp = SYSCALLS.getp();
                return FS.ioctl(stream, op, argp);
              }
              case 21523: {
                if (!stream.tty) return -59;
                if (stream.tty.ops.ioctl_tiocgwinsz) {
                  var winsize = stream.tty.ops.ioctl_tiocgwinsz(stream.tty);
                  var argp = SYSCALLS.getp();
                  HEAP16[argp >> 1] = winsize[0];
                  HEAP16[argp + 2 >> 1] = winsize[1];
                }
                return 0;
              }
              case 21524: {
                if (!stream.tty) return -59;
                return 0;
              }
              case 21515: {
                if (!stream.tty) return -59;
                return 0;
              }
              default:
                return -28;
            }
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
          }
        }
        function ___syscall_lstat64(path4, buf) {
          try {
            path4 = SYSCALLS.getStr(path4);
            return SYSCALLS.doStat(FS.lstat, path4, buf);
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
          }
        }
        function ___syscall_mkdirat(dirfd, path4, mode) {
          try {
            path4 = SYSCALLS.getStr(path4);
            path4 = SYSCALLS.calculateAt(dirfd, path4);
            path4 = PATH.normalize(path4);
            if (path4[path4.length - 1] === "/") path4 = path4.substr(0, path4.length - 1);
            FS.mkdir(path4, mode, 0);
            return 0;
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
          }
        }
        function ___syscall_newfstatat(dirfd, path4, buf, flags) {
          try {
            path4 = SYSCALLS.getStr(path4);
            var nofollow = flags & 256;
            var allowEmpty = flags & 4096;
            flags = flags & ~6400;
            path4 = SYSCALLS.calculateAt(dirfd, path4, allowEmpty);
            return SYSCALLS.doStat(nofollow ? FS.lstat : FS.stat, path4, buf);
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
          }
        }
        function ___syscall_openat(dirfd, path4, flags, varargs) {
          SYSCALLS.varargs = varargs;
          try {
            path4 = SYSCALLS.getStr(path4);
            path4 = SYSCALLS.calculateAt(dirfd, path4);
            var mode = varargs ? SYSCALLS.get() : 0;
            return FS.open(path4, flags, mode).fd;
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
          }
        }
        function ___syscall_readlinkat(dirfd, path4, buf, bufsize) {
          try {
            path4 = SYSCALLS.getStr(path4);
            path4 = SYSCALLS.calculateAt(dirfd, path4);
            if (bufsize <= 0) return -28;
            var ret = FS.readlink(path4);
            var len = Math.min(bufsize, lengthBytesUTF8(ret));
            var endChar = HEAP8[buf + len];
            stringToUTF8(ret, buf, bufsize + 1);
            HEAP8[buf + len] = endChar;
            return len;
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
          }
        }
        function ___syscall_rmdir(path4) {
          try {
            path4 = SYSCALLS.getStr(path4);
            FS.rmdir(path4);
            return 0;
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
          }
        }
        function ___syscall_stat64(path4, buf) {
          try {
            path4 = SYSCALLS.getStr(path4);
            return SYSCALLS.doStat(FS.stat, path4, buf);
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
          }
        }
        function ___syscall_unlinkat(dirfd, path4, flags) {
          try {
            path4 = SYSCALLS.getStr(path4);
            path4 = SYSCALLS.calculateAt(dirfd, path4);
            if (flags === 0) {
              FS.unlink(path4);
            } else if (flags === 512) {
              FS.rmdir(path4);
            } else {
              abort("Invalid flags passed to unlinkat");
            }
            return 0;
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
          }
        }
        var nowIsMonotonic = 1;
        var __emscripten_get_now_is_monotonic = () => nowIsMonotonic;
        var convertI32PairToI53Checked = (lo, hi) => hi + 2097152 >>> 0 < 4194305 - !!lo ? (lo >>> 0) + hi * 4294967296 : NaN;
        function __gmtime_js(time_low, time_high, tmPtr) {
          var time = convertI32PairToI53Checked(time_low, time_high);
          var date = new Date(time * 1e3);
          HEAP32[tmPtr >> 2] = date.getUTCSeconds();
          HEAP32[tmPtr + 4 >> 2] = date.getUTCMinutes();
          HEAP32[tmPtr + 8 >> 2] = date.getUTCHours();
          HEAP32[tmPtr + 12 >> 2] = date.getUTCDate();
          HEAP32[tmPtr + 16 >> 2] = date.getUTCMonth();
          HEAP32[tmPtr + 20 >> 2] = date.getUTCFullYear() - 1900;
          HEAP32[tmPtr + 24 >> 2] = date.getUTCDay();
          var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
          var yday = (date.getTime() - start) / (1e3 * 60 * 60 * 24) | 0;
          HEAP32[tmPtr + 28 >> 2] = yday;
        }
        var isLeapYear = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        var MONTH_DAYS_LEAP_CUMULATIVE = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
        var MONTH_DAYS_REGULAR_CUMULATIVE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        var ydayFromDate = (date) => {
          var leap = isLeapYear(date.getFullYear());
          var monthDaysCumulative = leap ? MONTH_DAYS_LEAP_CUMULATIVE : MONTH_DAYS_REGULAR_CUMULATIVE;
          var yday = monthDaysCumulative[date.getMonth()] + date.getDate() - 1;
          return yday;
        };
        function __localtime_js(time_low, time_high, tmPtr) {
          var time = convertI32PairToI53Checked(time_low, time_high);
          var date = new Date(time * 1e3);
          HEAP32[tmPtr >> 2] = date.getSeconds();
          HEAP32[tmPtr + 4 >> 2] = date.getMinutes();
          HEAP32[tmPtr + 8 >> 2] = date.getHours();
          HEAP32[tmPtr + 12 >> 2] = date.getDate();
          HEAP32[tmPtr + 16 >> 2] = date.getMonth();
          HEAP32[tmPtr + 20 >> 2] = date.getFullYear() - 1900;
          HEAP32[tmPtr + 24 >> 2] = date.getDay();
          var yday = ydayFromDate(date) | 0;
          HEAP32[tmPtr + 28 >> 2] = yday;
          HEAP32[tmPtr + 36 >> 2] = -(date.getTimezoneOffset() * 60);
          var start = new Date(date.getFullYear(), 0, 1);
          var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
          var winterOffset = start.getTimezoneOffset();
          var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
          HEAP32[tmPtr + 32 >> 2] = dst;
        }
        var __mktime_js = function(tmPtr) {
          var ret = (() => {
            var date = new Date(HEAP32[tmPtr + 20 >> 2] + 1900, HEAP32[tmPtr + 16 >> 2], HEAP32[tmPtr + 12 >> 2], HEAP32[tmPtr + 8 >> 2], HEAP32[tmPtr + 4 >> 2], HEAP32[tmPtr >> 2], 0);
            var dst = HEAP32[tmPtr + 32 >> 2];
            var guessedOffset = date.getTimezoneOffset();
            var start = new Date(date.getFullYear(), 0, 1);
            var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
            var winterOffset = start.getTimezoneOffset();
            var dstOffset = Math.min(winterOffset, summerOffset);
            if (dst < 0) {
              HEAP32[tmPtr + 32 >> 2] = Number(summerOffset != winterOffset && dstOffset == guessedOffset);
            } else if (dst > 0 != (dstOffset == guessedOffset)) {
              var nonDstOffset = Math.max(winterOffset, summerOffset);
              var trueOffset = dst > 0 ? dstOffset : nonDstOffset;
              date.setTime(date.getTime() + (trueOffset - guessedOffset) * 6e4);
            }
            HEAP32[tmPtr + 24 >> 2] = date.getDay();
            var yday = ydayFromDate(date) | 0;
            HEAP32[tmPtr + 28 >> 2] = yday;
            HEAP32[tmPtr >> 2] = date.getSeconds();
            HEAP32[tmPtr + 4 >> 2] = date.getMinutes();
            HEAP32[tmPtr + 8 >> 2] = date.getHours();
            HEAP32[tmPtr + 12 >> 2] = date.getDate();
            HEAP32[tmPtr + 16 >> 2] = date.getMonth();
            HEAP32[tmPtr + 20 >> 2] = date.getYear();
            var timeMs = date.getTime();
            if (isNaN(timeMs)) {
              setErrNo(61);
              return -1;
            }
            return timeMs / 1e3;
          })();
          return setTempRet0((tempDouble = ret, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)), ret >>> 0;
        };
        function __mmap_js(len, prot, flags, fd, offset_low, offset_high, allocated, addr) {
          var offset = convertI32PairToI53Checked(offset_low, offset_high);
          try {
            if (isNaN(offset)) return 61;
            var stream = SYSCALLS.getStreamFromFD(fd);
            var res = FS.mmap(stream, len, offset, prot, flags);
            var ptr = res.ptr;
            HEAP32[allocated >> 2] = res.allocated;
            HEAPU32[addr >> 2] = ptr;
            return 0;
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
          }
        }
        function __munmap_js(addr, len, prot, flags, fd, offset_low, offset_high) {
          var offset = convertI32PairToI53Checked(offset_low, offset_high);
          try {
            if (isNaN(offset)) return 61;
            var stream = SYSCALLS.getStreamFromFD(fd);
            if (prot & 2) {
              SYSCALLS.doMsync(addr, stream, len, flags, offset);
            }
            FS.munmap(stream);
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return -e.errno;
          }
        }
        var stringToNewUTF8 = (str) => {
          var size = lengthBytesUTF8(str) + 1;
          var ret = _malloc(size);
          if (ret) stringToUTF8(str, ret, size);
          return ret;
        };
        var __tzset_js = (timezone, daylight, tzname) => {
          var currentYear = (/* @__PURE__ */ new Date()).getFullYear();
          var winter = new Date(currentYear, 0, 1);
          var summer = new Date(currentYear, 6, 1);
          var winterOffset = winter.getTimezoneOffset();
          var summerOffset = summer.getTimezoneOffset();
          var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
          HEAPU32[timezone >> 2] = stdTimezoneOffset * 60;
          HEAP32[daylight >> 2] = Number(winterOffset != summerOffset);
          function extractZone(date) {
            var match = date.toTimeString().match(/\(([A-Za-z ]+)\)$/);
            return match ? match[1] : "GMT";
          }
          var winterName = extractZone(winter);
          var summerName = extractZone(summer);
          var winterNamePtr = stringToNewUTF8(winterName);
          var summerNamePtr = stringToNewUTF8(summerName);
          if (summerOffset < winterOffset) {
            HEAPU32[tzname >> 2] = winterNamePtr;
            HEAPU32[tzname + 4 >> 2] = summerNamePtr;
          } else {
            HEAPU32[tzname >> 2] = summerNamePtr;
            HEAPU32[tzname + 4 >> 2] = winterNamePtr;
          }
        };
        var _abort = () => {
          abort("");
        };
        var readEmAsmArgsArray = [];
        var readEmAsmArgs = (sigPtr, buf) => {
          readEmAsmArgsArray.length = 0;
          var ch;
          while (ch = HEAPU8[sigPtr++]) {
            var wide = ch != 105;
            wide &= ch != 112;
            buf += wide && buf % 8 ? 4 : 0;
            readEmAsmArgsArray.push(ch == 112 ? HEAPU32[buf >> 2] : ch == 105 ? HEAP32[buf >> 2] : HEAPF64[buf >> 3]);
            buf += wide ? 8 : 4;
          }
          return readEmAsmArgsArray;
        };
        var runEmAsmFunction = (code, sigPtr, argbuf) => {
          var args = readEmAsmArgs(sigPtr, argbuf);
          return ASM_CONSTS[code].apply(null, args);
        };
        var _emscripten_asm_const_int = (code, sigPtr, argbuf) => runEmAsmFunction(code, sigPtr, argbuf);
        var _emscripten_date_now = () => Date.now();
        var getHeapMax = () => 2147483648;
        var _emscripten_get_heap_max = () => getHeapMax();
        var _emscripten_get_now;
        _emscripten_get_now = () => performance.now();
        var _emscripten_memcpy_js = (dest, src, num) => HEAPU8.copyWithin(dest, src, src + num);
        var growMemory = (size) => {
          var b = wasmMemory.buffer;
          var pages = (size - b.byteLength + 65535) / 65536;
          try {
            wasmMemory.grow(pages);
            updateMemoryViews();
            return 1;
          } catch (e) {
          }
        };
        var _emscripten_resize_heap = (requestedSize) => {
          var oldSize = HEAPU8.length;
          requestedSize >>>= 0;
          var maxHeapSize = getHeapMax();
          if (requestedSize > maxHeapSize) {
            return false;
          }
          var alignUp = (x, multiple) => x + (multiple - x % multiple) % multiple;
          for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
            var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
            overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
            var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
            var replacement = growMemory(newSize);
            if (replacement) {
              return true;
            }
          }
          return false;
        };
        var ENV = {};
        var getExecutableName = () => thisProgram || "./this.program";
        var getEnvStrings = () => {
          if (!getEnvStrings.strings) {
            var lang = (typeof navigator == "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8";
            var env = { "USER": "web_user", "LOGNAME": "web_user", "PATH": "/", "PWD": "/", "HOME": "/home/web_user", "LANG": lang, "_": getExecutableName() };
            for (var x in ENV) {
              if (ENV[x] === void 0) delete env[x];
              else env[x] = ENV[x];
            }
            var strings = [];
            for (var x in env) {
              strings.push(`${x}=${env[x]}`);
            }
            getEnvStrings.strings = strings;
          }
          return getEnvStrings.strings;
        };
        var stringToAscii = (str, buffer) => {
          for (var i = 0; i < str.length; ++i) {
            HEAP8[buffer++ >> 0] = str.charCodeAt(i);
          }
          HEAP8[buffer >> 0] = 0;
        };
        var _environ_get = (__environ, environ_buf) => {
          var bufSize = 0;
          getEnvStrings().forEach((string, i) => {
            var ptr = environ_buf + bufSize;
            HEAPU32[__environ + i * 4 >> 2] = ptr;
            stringToAscii(string, ptr);
            bufSize += string.length + 1;
          });
          return 0;
        };
        var _environ_sizes_get = (penviron_count, penviron_buf_size) => {
          var strings = getEnvStrings();
          HEAPU32[penviron_count >> 2] = strings.length;
          var bufSize = 0;
          strings.forEach((string) => bufSize += string.length + 1);
          HEAPU32[penviron_buf_size >> 2] = bufSize;
          return 0;
        };
        var runtimeKeepaliveCounter = 0;
        var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;
        var _proc_exit = (code) => {
          EXITSTATUS = code;
          if (!keepRuntimeAlive()) {
            Module2["onExit"]?.(code);
            ABORT = true;
          }
          quit_(code, new ExitStatus(code));
        };
        var exitJS = (status, implicit) => {
          EXITSTATUS = status;
          _proc_exit(status);
        };
        var _exit = exitJS;
        function _fd_close(fd) {
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            FS.close(stream);
            return 0;
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return e.errno;
          }
        }
        var doReadv = (stream, iov, iovcnt, offset) => {
          var ret = 0;
          for (var i = 0; i < iovcnt; i++) {
            var ptr = HEAPU32[iov >> 2];
            var len = HEAPU32[iov + 4 >> 2];
            iov += 8;
            var curr = FS.read(stream, HEAP8, ptr, len, offset);
            if (curr < 0) return -1;
            ret += curr;
            if (curr < len) break;
            if (typeof offset !== "undefined") {
              offset += curr;
            }
          }
          return ret;
        };
        function _fd_read(fd, iov, iovcnt, pnum) {
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            var num = doReadv(stream, iov, iovcnt);
            HEAPU32[pnum >> 2] = num;
            return 0;
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return e.errno;
          }
        }
        function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
          var offset = convertI32PairToI53Checked(offset_low, offset_high);
          try {
            if (isNaN(offset)) return 61;
            var stream = SYSCALLS.getStreamFromFD(fd);
            FS.llseek(stream, offset, whence);
            tempI64 = [stream.position >>> 0, (tempDouble = stream.position, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[newOffset >> 2] = tempI64[0], HEAP32[newOffset + 4 >> 2] = tempI64[1];
            if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
            return 0;
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return e.errno;
          }
        }
        var doWritev = (stream, iov, iovcnt, offset) => {
          var ret = 0;
          for (var i = 0; i < iovcnt; i++) {
            var ptr = HEAPU32[iov >> 2];
            var len = HEAPU32[iov + 4 >> 2];
            iov += 8;
            var curr = FS.write(stream, HEAP8, ptr, len, offset);
            if (curr < 0) return -1;
            ret += curr;
            if (typeof offset !== "undefined") {
              offset += curr;
            }
          }
          return ret;
        };
        function _fd_write(fd, iov, iovcnt, pnum) {
          try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            var num = doWritev(stream, iov, iovcnt);
            HEAPU32[pnum >> 2] = num;
            return 0;
          } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError")) throw e;
            return e.errno;
          }
        }
        var _getentropy = (buffer, size) => {
          randomFill(HEAPU8.subarray(buffer, buffer + size));
          return 0;
        };
        var arraySum = (array, index) => {
          var sum = 0;
          for (var i = 0; i <= index; sum += array[i++]) {
          }
          return sum;
        };
        var MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        var MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        var addDays = (date, days) => {
          var newDate = new Date(date.getTime());
          while (days > 0) {
            var leap = isLeapYear(newDate.getFullYear());
            var currentMonth = newDate.getMonth();
            var daysInCurrentMonth = (leap ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR)[currentMonth];
            if (days > daysInCurrentMonth - newDate.getDate()) {
              days -= daysInCurrentMonth - newDate.getDate() + 1;
              newDate.setDate(1);
              if (currentMonth < 11) {
                newDate.setMonth(currentMonth + 1);
              } else {
                newDate.setMonth(0);
                newDate.setFullYear(newDate.getFullYear() + 1);
              }
            } else {
              newDate.setDate(newDate.getDate() + days);
              return newDate;
            }
          }
          return newDate;
        };
        var writeArrayToMemory = (array, buffer) => {
          HEAP8.set(array, buffer);
        };
        var _strftime = (s, maxsize, format, tm) => {
          var tm_zone = HEAPU32[tm + 40 >> 2];
          var date = { tm_sec: HEAP32[tm >> 2], tm_min: HEAP32[tm + 4 >> 2], tm_hour: HEAP32[tm + 8 >> 2], tm_mday: HEAP32[tm + 12 >> 2], tm_mon: HEAP32[tm + 16 >> 2], tm_year: HEAP32[tm + 20 >> 2], tm_wday: HEAP32[tm + 24 >> 2], tm_yday: HEAP32[tm + 28 >> 2], tm_isdst: HEAP32[tm + 32 >> 2], tm_gmtoff: HEAP32[tm + 36 >> 2], tm_zone: tm_zone ? UTF8ToString(tm_zone) : "" };
          var pattern = UTF8ToString(format);
          var EXPANSION_RULES_1 = { "%c": "%a %b %d %H:%M:%S %Y", "%D": "%m/%d/%y", "%F": "%Y-%m-%d", "%h": "%b", "%r": "%I:%M:%S %p", "%R": "%H:%M", "%T": "%H:%M:%S", "%x": "%m/%d/%y", "%X": "%H:%M:%S", "%Ec": "%c", "%EC": "%C", "%Ex": "%m/%d/%y", "%EX": "%H:%M:%S", "%Ey": "%y", "%EY": "%Y", "%Od": "%d", "%Oe": "%e", "%OH": "%H", "%OI": "%I", "%Om": "%m", "%OM": "%M", "%OS": "%S", "%Ou": "%u", "%OU": "%U", "%OV": "%V", "%Ow": "%w", "%OW": "%W", "%Oy": "%y" };
          for (var rule in EXPANSION_RULES_1) {
            pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_1[rule]);
          }
          var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          function leadingSomething(value, digits, character) {
            var str = typeof value == "number" ? value.toString() : value || "";
            while (str.length < digits) {
              str = character[0] + str;
            }
            return str;
          }
          function leadingNulls(value, digits) {
            return leadingSomething(value, digits, "0");
          }
          function compareByDay(date1, date2) {
            function sgn(value) {
              return value < 0 ? -1 : value > 0 ? 1 : 0;
            }
            var compare;
            if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
              if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
                compare = sgn(date1.getDate() - date2.getDate());
              }
            }
            return compare;
          }
          function getFirstWeekStartDate(janFourth) {
            switch (janFourth.getDay()) {
              case 0:
                return new Date(janFourth.getFullYear() - 1, 11, 29);
              case 1:
                return janFourth;
              case 2:
                return new Date(janFourth.getFullYear(), 0, 3);
              case 3:
                return new Date(janFourth.getFullYear(), 0, 2);
              case 4:
                return new Date(janFourth.getFullYear(), 0, 1);
              case 5:
                return new Date(janFourth.getFullYear() - 1, 11, 31);
              case 6:
                return new Date(janFourth.getFullYear() - 1, 11, 30);
            }
          }
          function getWeekBasedYear(date2) {
            var thisDate = addDays(new Date(date2.tm_year + 1900, 0, 1), date2.tm_yday);
            var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
            var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
            var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
            var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
            if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
              if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
                return thisDate.getFullYear() + 1;
              }
              return thisDate.getFullYear();
            }
            return thisDate.getFullYear() - 1;
          }
          var EXPANSION_RULES_2 = { "%a": (date2) => WEEKDAYS[date2.tm_wday].substring(0, 3), "%A": (date2) => WEEKDAYS[date2.tm_wday], "%b": (date2) => MONTHS[date2.tm_mon].substring(0, 3), "%B": (date2) => MONTHS[date2.tm_mon], "%C": (date2) => {
            var year = date2.tm_year + 1900;
            return leadingNulls(year / 100 | 0, 2);
          }, "%d": (date2) => leadingNulls(date2.tm_mday, 2), "%e": (date2) => leadingSomething(date2.tm_mday, 2, " "), "%g": (date2) => getWeekBasedYear(date2).toString().substring(2), "%G": (date2) => getWeekBasedYear(date2), "%H": (date2) => leadingNulls(date2.tm_hour, 2), "%I": (date2) => {
            var twelveHour = date2.tm_hour;
            if (twelveHour == 0) twelveHour = 12;
            else if (twelveHour > 12) twelveHour -= 12;
            return leadingNulls(twelveHour, 2);
          }, "%j": (date2) => leadingNulls(date2.tm_mday + arraySum(isLeapYear(date2.tm_year + 1900) ? MONTH_DAYS_LEAP : MONTH_DAYS_REGULAR, date2.tm_mon - 1), 3), "%m": (date2) => leadingNulls(date2.tm_mon + 1, 2), "%M": (date2) => leadingNulls(date2.tm_min, 2), "%n": () => "\n", "%p": (date2) => {
            if (date2.tm_hour >= 0 && date2.tm_hour < 12) {
              return "AM";
            }
            return "PM";
          }, "%S": (date2) => leadingNulls(date2.tm_sec, 2), "%t": () => "	", "%u": (date2) => date2.tm_wday || 7, "%U": (date2) => {
            var days = date2.tm_yday + 7 - date2.tm_wday;
            return leadingNulls(Math.floor(days / 7), 2);
          }, "%V": (date2) => {
            var val = Math.floor((date2.tm_yday + 7 - (date2.tm_wday + 6) % 7) / 7);
            if ((date2.tm_wday + 371 - date2.tm_yday - 2) % 7 <= 2) {
              val++;
            }
            if (!val) {
              val = 52;
              var dec31 = (date2.tm_wday + 7 - date2.tm_yday - 1) % 7;
              if (dec31 == 4 || dec31 == 5 && isLeapYear(date2.tm_year % 400 - 1)) {
                val++;
              }
            } else if (val == 53) {
              var jan1 = (date2.tm_wday + 371 - date2.tm_yday) % 7;
              if (jan1 != 4 && (jan1 != 3 || !isLeapYear(date2.tm_year))) val = 1;
            }
            return leadingNulls(val, 2);
          }, "%w": (date2) => date2.tm_wday, "%W": (date2) => {
            var days = date2.tm_yday + 7 - (date2.tm_wday + 6) % 7;
            return leadingNulls(Math.floor(days / 7), 2);
          }, "%y": (date2) => (date2.tm_year + 1900).toString().substring(2), "%Y": (date2) => date2.tm_year + 1900, "%z": (date2) => {
            var off = date2.tm_gmtoff;
            var ahead = off >= 0;
            off = Math.abs(off) / 60;
            off = off / 60 * 100 + off % 60;
            return (ahead ? "+" : "-") + String("0000" + off).slice(-4);
          }, "%Z": (date2) => date2.tm_zone, "%%": () => "%" };
          pattern = pattern.replace(/%%/g, "\0\0");
          for (var rule in EXPANSION_RULES_2) {
            if (pattern.includes(rule)) {
              pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_2[rule](date));
            }
          }
          pattern = pattern.replace(/\0\0/g, "%");
          var bytes = intArrayFromString(pattern, false);
          if (bytes.length > maxsize) {
            return 0;
          }
          writeArrayToMemory(bytes, s);
          return bytes.length - 1;
        };
        var _strftime_l = (s, maxsize, format, tm, loc) => _strftime(s, maxsize, format, tm);
        var getCFunc = (ident) => {
          var func = Module2["_" + ident];
          return func;
        };
        var stringToUTF8OnStack = (str) => {
          var size = lengthBytesUTF8(str) + 1;
          var ret = stackAlloc(size);
          stringToUTF8(str, ret, size);
          return ret;
        };
        var ccall = (ident, returnType, argTypes, args, opts) => {
          var toC = { "string": (str) => {
            var ret2 = 0;
            if (str !== null && str !== void 0 && str !== 0) {
              ret2 = stringToUTF8OnStack(str);
            }
            return ret2;
          }, "array": (arr) => {
            var ret2 = stackAlloc(arr.length);
            writeArrayToMemory(arr, ret2);
            return ret2;
          } };
          function convertReturnValue(ret2) {
            if (returnType === "string") {
              return UTF8ToString(ret2);
            }
            if (returnType === "boolean") return Boolean(ret2);
            return ret2;
          }
          var func = getCFunc(ident);
          var cArgs = [];
          var stack = 0;
          if (args) {
            for (var i = 0; i < args.length; i++) {
              var converter = toC[argTypes[i]];
              if (converter) {
                if (stack === 0) stack = stackSave();
                cArgs[i] = converter(args[i]);
              } else {
                cArgs[i] = args[i];
              }
            }
          }
          var ret = func.apply(null, cArgs);
          function onDone(ret2) {
            if (stack !== 0) stackRestore(stack);
            return convertReturnValue(ret2);
          }
          ret = onDone(ret);
          return ret;
        };
        var uleb128Encode = (n, target) => {
          if (n < 128) {
            target.push(n);
          } else {
            target.push(n % 128 | 128, n >> 7);
          }
        };
        var sigToWasmTypes = (sig) => {
          var typeNames = { "i": "i32", "j": "i64", "f": "f32", "d": "f64", "e": "externref", "p": "i32" };
          var type = { parameters: [], results: sig[0] == "v" ? [] : [typeNames[sig[0]]] };
          for (var i = 1; i < sig.length; ++i) {
            type.parameters.push(typeNames[sig[i]]);
          }
          return type;
        };
        var generateFuncType = (sig, target) => {
          var sigRet = sig.slice(0, 1);
          var sigParam = sig.slice(1);
          var typeCodes = { "i": 127, "p": 127, "j": 126, "f": 125, "d": 124, "e": 111 };
          target.push(96);
          uleb128Encode(sigParam.length, target);
          for (var i = 0; i < sigParam.length; ++i) {
            target.push(typeCodes[sigParam[i]]);
          }
          if (sigRet == "v") {
            target.push(0);
          } else {
            target.push(1, typeCodes[sigRet]);
          }
        };
        var convertJsFunctionToWasm = (func, sig) => {
          if (typeof WebAssembly.Function == "function") {
            return new WebAssembly.Function(sigToWasmTypes(sig), func);
          }
          var typeSectionBody = [1];
          generateFuncType(sig, typeSectionBody);
          var bytes = [0, 97, 115, 109, 1, 0, 0, 0, 1];
          uleb128Encode(typeSectionBody.length, bytes);
          bytes.push.apply(bytes, typeSectionBody);
          bytes.push(2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0);
          var module3 = new WebAssembly.Module(new Uint8Array(bytes));
          var instance = new WebAssembly.Instance(module3, { "e": { "f": func } });
          var wrappedFunc = instance.exports["f"];
          return wrappedFunc;
        };
        var wasmTableMirror = [];
        var wasmTable;
        var getWasmTableEntry = (funcPtr) => {
          var func = wasmTableMirror[funcPtr];
          if (!func) {
            if (funcPtr >= wasmTableMirror.length) wasmTableMirror.length = funcPtr + 1;
            wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
          }
          return func;
        };
        var updateTableMap = (offset, count) => {
          if (functionsInTableMap) {
            for (var i = offset; i < offset + count; i++) {
              var item = getWasmTableEntry(i);
              if (item) {
                functionsInTableMap.set(item, i);
              }
            }
          }
        };
        var functionsInTableMap;
        var getFunctionAddress = (func) => {
          if (!functionsInTableMap) {
            functionsInTableMap = /* @__PURE__ */ new WeakMap();
            updateTableMap(0, wasmTable.length);
          }
          return functionsInTableMap.get(func) || 0;
        };
        var freeTableIndexes = [];
        var getEmptyTableSlot = () => {
          if (freeTableIndexes.length) {
            return freeTableIndexes.pop();
          }
          try {
            wasmTable.grow(1);
          } catch (err2) {
            if (!(err2 instanceof RangeError)) {
              throw err2;
            }
            throw "Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.";
          }
          return wasmTable.length - 1;
        };
        var setWasmTableEntry = (idx, func) => {
          wasmTable.set(idx, func);
          wasmTableMirror[idx] = wasmTable.get(idx);
        };
        var addFunction = (func, sig) => {
          var rtn = getFunctionAddress(func);
          if (rtn) {
            return rtn;
          }
          var ret = getEmptyTableSlot();
          try {
            setWasmTableEntry(ret, func);
          } catch (err2) {
            if (!(err2 instanceof TypeError)) {
              throw err2;
            }
            var wrapped = convertJsFunctionToWasm(func, sig);
            setWasmTableEntry(ret, wrapped);
          }
          functionsInTableMap.set(func, ret);
          return ret;
        };
        var removeFunction = (index) => {
          functionsInTableMap.delete(getWasmTableEntry(index));
          setWasmTableEntry(index, null);
          freeTableIndexes.push(index);
        };
        var FSNode = function(parent, name, mode, rdev) {
          if (!parent) {
            parent = this;
          }
          this.parent = parent;
          this.mount = parent.mount;
          this.mounted = null;
          this.id = FS.nextInode++;
          this.name = name;
          this.mode = mode;
          this.node_ops = {};
          this.stream_ops = {};
          this.rdev = rdev;
        };
        var readMode = 292 | 73;
        var writeMode = 146;
        Object.defineProperties(FSNode.prototype, { read: { get: function() {
          return (this.mode & readMode) === readMode;
        }, set: function(val) {
          val ? this.mode |= readMode : this.mode &= ~readMode;
        } }, write: { get: function() {
          return (this.mode & writeMode) === writeMode;
        }, set: function(val) {
          val ? this.mode |= writeMode : this.mode &= ~writeMode;
        } }, isFolder: { get: function() {
          return FS.isDir(this.mode);
        } }, isDevice: { get: function() {
          return FS.isChrdev(this.mode);
        } } });
        FS.FSNode = FSNode;
        FS.createPreloadedFile = FS_createPreloadedFile;
        FS.staticInit();
        Module2["FS_createPath"] = FS.createPath;
        Module2["FS_createDataFile"] = FS.createDataFile;
        Module2["FS_createPreloadedFile"] = FS.createPreloadedFile;
        Module2["FS_unlink"] = FS.unlink;
        Module2["FS_createLazyFile"] = FS.createLazyFile;
        Module2["FS_createDevice"] = FS.createDevice;
        if (ENVIRONMENT_IS_NODE) {
          NODEFS.staticInit();
        }
        if (ENVIRONMENT_IS_NODE) {
          var _wrapNodeError = function(func) {
            return function() {
              try {
                return func.apply(this, arguments);
              } catch (e) {
                if (e.code) {
                  throw new FS.ErrnoError(ERRNO_CODES[e.code]);
                }
                throw e;
              }
            };
          };
          var VFS = Object.assign({}, FS);
          for (var _key in NODERAWFS) {
            FS[_key] = _wrapNodeError(NODERAWFS[_key]);
          }
        } else {
          throw new Error("NODERAWFS is currently only supported on Node.js environment.");
        }
        var wasmImports = { a: ___cxa_throw, e: ___syscall_fcntl64, F: ___syscall_fstat64, I: ___syscall_getcwd, A: ___syscall_getdents64, J: ___syscall_ioctl, C: ___syscall_lstat64, B: ___syscall_mkdirat, D: ___syscall_newfstatat, k: ___syscall_openat, H: ___syscall_readlinkat, y: ___syscall_rmdir, E: ___syscall_stat64, z: ___syscall_unlinkat, K: __emscripten_get_now_is_monotonic, r: __gmtime_js, s: __localtime_js, t: __mktime_js, p: __mmap_js, q: __munmap_js, G: __tzset_js, f: _abort, x: _emscripten_asm_const_int, i: _emscripten_date_now, l: _emscripten_get_heap_max, c: _emscripten_get_now, L: _emscripten_memcpy_js, o: _emscripten_resize_heap, m: _environ_get, n: _environ_sizes_get, b: _exit, g: _fd_close, j: _fd_read, u: _fd_seek, h: _fd_write, v: _getentropy, w: _strftime, d: _strftime_l };
        var wasmExports = createWasm();
        var ___wasm_call_ctors = wasmExports["N"];
        var _PrintOfflineTtsConfig = Module2["_PrintOfflineTtsConfig"] = wasmExports["O"];
        var _PrintOfflineRecognizerConfig = Module2["_PrintOfflineRecognizerConfig"] = wasmExports["P"];
        var _CopyHeap = Module2["_CopyHeap"] = wasmExports["Q"];
        var _SherpaOnnxGetVersionStr = Module2["_SherpaOnnxGetVersionStr"] = wasmExports["R"];
        var _SherpaOnnxGetGitSha1 = Module2["_SherpaOnnxGetGitSha1"] = wasmExports["S"];
        var _SherpaOnnxGetGitDate = Module2["_SherpaOnnxGetGitDate"] = wasmExports["T"];
        var _SherpaOnnxCreateOnlineRecognizer = Module2["_SherpaOnnxCreateOnlineRecognizer"] = wasmExports["U"];
        var _SherpaOnnxDestroyOnlineRecognizer = Module2["_SherpaOnnxDestroyOnlineRecognizer"] = wasmExports["V"];
        var _SherpaOnnxCreateOnlineStream = Module2["_SherpaOnnxCreateOnlineStream"] = wasmExports["W"];
        var _SherpaOnnxDestroyOnlineStream = Module2["_SherpaOnnxDestroyOnlineStream"] = wasmExports["X"];
        var _SherpaOnnxOnlineStreamAcceptWaveform = Module2["_SherpaOnnxOnlineStreamAcceptWaveform"] = wasmExports["Y"];
        var _SherpaOnnxIsOnlineStreamReady = Module2["_SherpaOnnxIsOnlineStreamReady"] = wasmExports["Z"];
        var _SherpaOnnxDecodeOnlineStream = Module2["_SherpaOnnxDecodeOnlineStream"] = wasmExports["_"];
        var _SherpaOnnxGetOnlineStreamResult = Module2["_SherpaOnnxGetOnlineStreamResult"] = wasmExports["$"];
        var _SherpaOnnxDestroyOnlineRecognizerResult = Module2["_SherpaOnnxDestroyOnlineRecognizerResult"] = wasmExports["aa"];
        var _SherpaOnnxGetOnlineStreamResultAsJson = Module2["_SherpaOnnxGetOnlineStreamResultAsJson"] = wasmExports["ba"];
        var _SherpaOnnxDestroyOnlineStreamResultJson = Module2["_SherpaOnnxDestroyOnlineStreamResultJson"] = wasmExports["ca"];
        var _SherpaOnnxOnlineStreamReset = Module2["_SherpaOnnxOnlineStreamReset"] = wasmExports["da"];
        var _SherpaOnnxOnlineStreamInputFinished = Module2["_SherpaOnnxOnlineStreamInputFinished"] = wasmExports["ea"];
        var _SherpaOnnxOnlineStreamSetOption = Module2["_SherpaOnnxOnlineStreamSetOption"] = wasmExports["fa"];
        var _SherpaOnnxOnlineStreamGetOption = Module2["_SherpaOnnxOnlineStreamGetOption"] = wasmExports["ga"];
        var _SherpaOnnxOnlineStreamIsEndpoint = Module2["_SherpaOnnxOnlineStreamIsEndpoint"] = wasmExports["ha"];
        var _SherpaOnnxCreateOfflineRecognizer = Module2["_SherpaOnnxCreateOfflineRecognizer"] = wasmExports["ia"];
        var _SherpaOnnxOfflineRecognizerSetConfig = Module2["_SherpaOnnxOfflineRecognizerSetConfig"] = wasmExports["ja"];
        var _SherpaOnnxDestroyOfflineRecognizer = Module2["_SherpaOnnxDestroyOfflineRecognizer"] = wasmExports["ka"];
        var _SherpaOnnxCreateOfflineStream = Module2["_SherpaOnnxCreateOfflineStream"] = wasmExports["la"];
        var _SherpaOnnxDestroyOfflineStream = Module2["_SherpaOnnxDestroyOfflineStream"] = wasmExports["ma"];
        var _SherpaOnnxAcceptWaveformOffline = Module2["_SherpaOnnxAcceptWaveformOffline"] = wasmExports["na"];
        var _SherpaOnnxOfflineStreamSetOption = Module2["_SherpaOnnxOfflineStreamSetOption"] = wasmExports["oa"];
        var _SherpaOnnxOfflineStreamGetOption = Module2["_SherpaOnnxOfflineStreamGetOption"] = wasmExports["pa"];
        var _SherpaOnnxDecodeOfflineStream = Module2["_SherpaOnnxDecodeOfflineStream"] = wasmExports["qa"];
        var _SherpaOnnxDecodeMultipleOfflineStreams = Module2["_SherpaOnnxDecodeMultipleOfflineStreams"] = wasmExports["ra"];
        var _SherpaOnnxGetOfflineStreamResult = Module2["_SherpaOnnxGetOfflineStreamResult"] = wasmExports["sa"];
        var _SherpaOnnxDestroyOfflineRecognizerResult = Module2["_SherpaOnnxDestroyOfflineRecognizerResult"] = wasmExports["ta"];
        var _SherpaOnnxGetOfflineStreamResultAsJson = Module2["_SherpaOnnxGetOfflineStreamResultAsJson"] = wasmExports["ua"];
        var _SherpaOnnxDestroyOfflineStreamResultJson = Module2["_SherpaOnnxDestroyOfflineStreamResultJson"] = wasmExports["va"];
        var _SherpaOnnxCreateKeywordSpotter = Module2["_SherpaOnnxCreateKeywordSpotter"] = wasmExports["wa"];
        var _SherpaOnnxDestroyKeywordSpotter = Module2["_SherpaOnnxDestroyKeywordSpotter"] = wasmExports["xa"];
        var _SherpaOnnxCreateKeywordStream = Module2["_SherpaOnnxCreateKeywordStream"] = wasmExports["ya"];
        var _SherpaOnnxIsKeywordStreamReady = Module2["_SherpaOnnxIsKeywordStreamReady"] = wasmExports["za"];
        var _SherpaOnnxDecodeKeywordStream = Module2["_SherpaOnnxDecodeKeywordStream"] = wasmExports["Aa"];
        var _SherpaOnnxResetKeywordStream = Module2["_SherpaOnnxResetKeywordStream"] = wasmExports["Ba"];
        var _SherpaOnnxGetKeywordResult = Module2["_SherpaOnnxGetKeywordResult"] = wasmExports["Ca"];
        var _SherpaOnnxDestroyKeywordResult = Module2["_SherpaOnnxDestroyKeywordResult"] = wasmExports["Da"];
        var _SherpaOnnxCreateCircularBuffer = Module2["_SherpaOnnxCreateCircularBuffer"] = wasmExports["Ea"];
        var _SherpaOnnxDestroyCircularBuffer = Module2["_SherpaOnnxDestroyCircularBuffer"] = wasmExports["Fa"];
        var _SherpaOnnxCircularBufferPush = Module2["_SherpaOnnxCircularBufferPush"] = wasmExports["Ga"];
        var _SherpaOnnxCircularBufferGet = Module2["_SherpaOnnxCircularBufferGet"] = wasmExports["Ha"];
        var _SherpaOnnxCircularBufferFree = Module2["_SherpaOnnxCircularBufferFree"] = wasmExports["Ia"];
        var _SherpaOnnxCircularBufferPop = Module2["_SherpaOnnxCircularBufferPop"] = wasmExports["Ja"];
        var _SherpaOnnxCircularBufferSize = Module2["_SherpaOnnxCircularBufferSize"] = wasmExports["Ka"];
        var _SherpaOnnxCircularBufferHead = Module2["_SherpaOnnxCircularBufferHead"] = wasmExports["La"];
        var _SherpaOnnxCircularBufferReset = Module2["_SherpaOnnxCircularBufferReset"] = wasmExports["Ma"];
        var _SherpaOnnxCreateVoiceActivityDetector = Module2["_SherpaOnnxCreateVoiceActivityDetector"] = wasmExports["Na"];
        var _SherpaOnnxDestroyVoiceActivityDetector = Module2["_SherpaOnnxDestroyVoiceActivityDetector"] = wasmExports["Oa"];
        var _SherpaOnnxVoiceActivityDetectorAcceptWaveform = Module2["_SherpaOnnxVoiceActivityDetectorAcceptWaveform"] = wasmExports["Pa"];
        var _SherpaOnnxVoiceActivityDetectorEmpty = Module2["_SherpaOnnxVoiceActivityDetectorEmpty"] = wasmExports["Qa"];
        var _SherpaOnnxVoiceActivityDetectorDetected = Module2["_SherpaOnnxVoiceActivityDetectorDetected"] = wasmExports["Ra"];
        var _SherpaOnnxVoiceActivityDetectorPop = Module2["_SherpaOnnxVoiceActivityDetectorPop"] = wasmExports["Sa"];
        var _SherpaOnnxVoiceActivityDetectorClear = Module2["_SherpaOnnxVoiceActivityDetectorClear"] = wasmExports["Ta"];
        var _SherpaOnnxVoiceActivityDetectorFront = Module2["_SherpaOnnxVoiceActivityDetectorFront"] = wasmExports["Ua"];
        var _SherpaOnnxDestroySpeechSegment = Module2["_SherpaOnnxDestroySpeechSegment"] = wasmExports["Va"];
        var _SherpaOnnxVoiceActivityDetectorReset = Module2["_SherpaOnnxVoiceActivityDetectorReset"] = wasmExports["Wa"];
        var _SherpaOnnxVoiceActivityDetectorFlush = Module2["_SherpaOnnxVoiceActivityDetectorFlush"] = wasmExports["Xa"];
        var _SherpaOnnxCreateOfflineTts = Module2["_SherpaOnnxCreateOfflineTts"] = wasmExports["Ya"];
        var _SherpaOnnxDestroyOfflineTts = Module2["_SherpaOnnxDestroyOfflineTts"] = wasmExports["Za"];
        var _SherpaOnnxOfflineTtsSampleRate = Module2["_SherpaOnnxOfflineTtsSampleRate"] = wasmExports["_a"];
        var _SherpaOnnxOfflineTtsNumSpeakers = Module2["_SherpaOnnxOfflineTtsNumSpeakers"] = wasmExports["$a"];
        var _SherpaOnnxOfflineTtsGenerate = Module2["_SherpaOnnxOfflineTtsGenerate"] = wasmExports["ab"];
        var _SherpaOnnxOfflineTtsGenerateWithCallback = Module2["_SherpaOnnxOfflineTtsGenerateWithCallback"] = wasmExports["bb"];
        var _SherpaOnnxOfflineTtsGenerateWithConfig = Module2["_SherpaOnnxOfflineTtsGenerateWithConfig"] = wasmExports["cb"];
        var _SherpaOnnxDestroyOfflineTtsGeneratedAudio = Module2["_SherpaOnnxDestroyOfflineTtsGeneratedAudio"] = wasmExports["db"];
        var _SherpaOnnxWriteWave = Module2["_SherpaOnnxWriteWave"] = wasmExports["eb"];
        var _SherpaOnnxReadWave = Module2["_SherpaOnnxReadWave"] = wasmExports["fb"];
        var _SherpaOnnxReadWaveFromBinaryData = Module2["_SherpaOnnxReadWaveFromBinaryData"] = wasmExports["gb"];
        var _SherpaOnnxFreeWave = Module2["_SherpaOnnxFreeWave"] = wasmExports["hb"];
        var _SherpaOnnxCreateOfflinePunctuation = Module2["_SherpaOnnxCreateOfflinePunctuation"] = wasmExports["ib"];
        var _SherpaOnnxDestroyOfflinePunctuation = Module2["_SherpaOnnxDestroyOfflinePunctuation"] = wasmExports["jb"];
        var _SherpaOfflinePunctuationAddPunct = Module2["_SherpaOfflinePunctuationAddPunct"] = wasmExports["kb"];
        var _SherpaOfflinePunctuationFreeText = Module2["_SherpaOfflinePunctuationFreeText"] = wasmExports["lb"];
        var _SherpaOnnxCreateOnlinePunctuation = Module2["_SherpaOnnxCreateOnlinePunctuation"] = wasmExports["mb"];
        var _SherpaOnnxDestroyOnlinePunctuation = Module2["_SherpaOnnxDestroyOnlinePunctuation"] = wasmExports["nb"];
        var _SherpaOnnxOnlinePunctuationAddPunct = Module2["_SherpaOnnxOnlinePunctuationAddPunct"] = wasmExports["ob"];
        var _SherpaOnnxOnlinePunctuationFreeText = Module2["_SherpaOnnxOnlinePunctuationFreeText"] = wasmExports["pb"];
        var _SherpaOnnxFileExists = Module2["_SherpaOnnxFileExists"] = wasmExports["qb"];
        var _SherpaOnnxCreateOfflineSpeechDenoiser = Module2["_SherpaOnnxCreateOfflineSpeechDenoiser"] = wasmExports["rb"];
        var _SherpaOnnxDestroyOfflineSpeechDenoiser = Module2["_SherpaOnnxDestroyOfflineSpeechDenoiser"] = wasmExports["sb"];
        var _SherpaOnnxOfflineSpeechDenoiserGetSampleRate = Module2["_SherpaOnnxOfflineSpeechDenoiserGetSampleRate"] = wasmExports["tb"];
        var _SherpaOnnxOfflineSpeechDenoiserRun = Module2["_SherpaOnnxOfflineSpeechDenoiserRun"] = wasmExports["ub"];
        var _SherpaOnnxDestroyDenoisedAudio = Module2["_SherpaOnnxDestroyDenoisedAudio"] = wasmExports["vb"];
        var _SherpaOnnxCreateOnlineSpeechDenoiser = Module2["_SherpaOnnxCreateOnlineSpeechDenoiser"] = wasmExports["wb"];
        var _SherpaOnnxDestroyOnlineSpeechDenoiser = Module2["_SherpaOnnxDestroyOnlineSpeechDenoiser"] = wasmExports["xb"];
        var _SherpaOnnxOnlineSpeechDenoiserGetSampleRate = Module2["_SherpaOnnxOnlineSpeechDenoiserGetSampleRate"] = wasmExports["yb"];
        var _SherpaOnnxOnlineSpeechDenoiserGetFrameShiftInSamples = Module2["_SherpaOnnxOnlineSpeechDenoiserGetFrameShiftInSamples"] = wasmExports["zb"];
        var _SherpaOnnxOnlineSpeechDenoiserRun = Module2["_SherpaOnnxOnlineSpeechDenoiserRun"] = wasmExports["Ab"];
        var _SherpaOnnxOnlineSpeechDenoiserFlush = Module2["_SherpaOnnxOnlineSpeechDenoiserFlush"] = wasmExports["Bb"];
        var _SherpaOnnxOnlineSpeechDenoiserReset = Module2["_SherpaOnnxOnlineSpeechDenoiserReset"] = wasmExports["Cb"];
        var _SherpaOnnxCreateOfflineSpeakerDiarization = Module2["_SherpaOnnxCreateOfflineSpeakerDiarization"] = wasmExports["Db"];
        var _SherpaOnnxDestroyOfflineSpeakerDiarization = Module2["_SherpaOnnxDestroyOfflineSpeakerDiarization"] = wasmExports["Eb"];
        var _SherpaOnnxOfflineSpeakerDiarizationGetSampleRate = Module2["_SherpaOnnxOfflineSpeakerDiarizationGetSampleRate"] = wasmExports["Fb"];
        var _SherpaOnnxOfflineSpeakerDiarizationSetConfig = Module2["_SherpaOnnxOfflineSpeakerDiarizationSetConfig"] = wasmExports["Gb"];
        var _SherpaOnnxOfflineSpeakerDiarizationResultGetNumSegments = Module2["_SherpaOnnxOfflineSpeakerDiarizationResultGetNumSegments"] = wasmExports["Hb"];
        var _SherpaOnnxOfflineSpeakerDiarizationResultSortByStartTime = Module2["_SherpaOnnxOfflineSpeakerDiarizationResultSortByStartTime"] = wasmExports["Ib"];
        var _SherpaOnnxOfflineSpeakerDiarizationDestroySegment = Module2["_SherpaOnnxOfflineSpeakerDiarizationDestroySegment"] = wasmExports["Jb"];
        var _SherpaOnnxOfflineSpeakerDiarizationProcess = Module2["_SherpaOnnxOfflineSpeakerDiarizationProcess"] = wasmExports["Kb"];
        var _SherpaOnnxOfflineSpeakerDiarizationDestroyResult = Module2["_SherpaOnnxOfflineSpeakerDiarizationDestroyResult"] = wasmExports["Lb"];
        var _SherpaOnnxOfflineSpeakerDiarizationProcessWithCallback = Module2["_SherpaOnnxOfflineSpeakerDiarizationProcessWithCallback"] = wasmExports["Mb"];
        var ___errno_location = wasmExports["Nb"];
        var _malloc = Module2["_malloc"] = wasmExports["Pb"];
        var _free = Module2["_free"] = wasmExports["Qb"];
        var _emscripten_builtin_memalign = wasmExports["Rb"];
        var setTempRet0 = wasmExports["Sb"];
        var stackSave = wasmExports["Tb"];
        var stackRestore = wasmExports["Ub"];
        var stackAlloc = wasmExports["Vb"];
        var ___cxa_is_pointer_type = wasmExports["Wb"];
        Module2["addRunDependency"] = addRunDependency;
        Module2["removeRunDependency"] = removeRunDependency;
        Module2["FS_createPath"] = FS.createPath;
        Module2["FS_createLazyFile"] = FS.createLazyFile;
        Module2["FS_createDevice"] = FS.createDevice;
        Module2["ccall"] = ccall;
        Module2["addFunction"] = addFunction;
        Module2["removeFunction"] = removeFunction;
        Module2["setValue"] = setValue;
        Module2["getValue"] = getValue;
        Module2["UTF8ToString"] = UTF8ToString;
        Module2["stringToUTF8"] = stringToUTF8;
        Module2["lengthBytesUTF8"] = lengthBytesUTF8;
        Module2["FS_createPreloadedFile"] = FS.createPreloadedFile;
        Module2["FS_createDataFile"] = FS.createDataFile;
        Module2["FS_unlink"] = FS.unlink;
        var calledRun;
        dependenciesFulfilled = function runCaller() {
          if (!calledRun) run();
          if (!calledRun) dependenciesFulfilled = runCaller;
        };
        function run() {
          if (runDependencies > 0) {
            return;
          }
          preRun();
          if (runDependencies > 0) {
            return;
          }
          function doRun() {
            if (calledRun) return;
            calledRun = true;
            Module2["calledRun"] = true;
            if (ABORT) return;
            initRuntime();
            readyPromiseResolve(Module2);
            if (Module2["onRuntimeInitialized"]) Module2["onRuntimeInitialized"]();
            postRun();
          }
          if (Module2["setStatus"]) {
            Module2["setStatus"]("Running...");
            setTimeout(function() {
              setTimeout(function() {
                Module2["setStatus"]("");
              }, 1);
              doRun();
            }, 1);
          } else {
            doRun();
          }
        }
        if (Module2["preInit"]) {
          if (typeof Module2["preInit"] == "function") Module2["preInit"] = [Module2["preInit"]];
          while (Module2["preInit"].length > 0) {
            Module2["preInit"].pop()();
          }
        }
        run();
        return moduleArg;
      };
    })();
    if (typeof exports2 === "object" && typeof module2 === "object")
      module2.exports = Module;
    else if (typeof define === "function" && define["amd"])
      define([], () => Module);
  }
});

// node_modules/sherpa-onnx/sherpa-onnx-asr.js
var require_sherpa_onnx_asr = __commonJS({
  "node_modules/sherpa-onnx/sherpa-onnx-asr.js"(exports2, module2) {
    function freeConfig(config, Module) {
      if ("buffer" in config) {
        Module._free(config.buffer);
      }
      if ("config" in config) {
        freeConfig(config.config, Module);
      }
      if ("transducer" in config) {
        freeConfig(config.transducer, Module);
      }
      if ("paraformer" in config) {
        freeConfig(config.paraformer, Module);
      }
      if ("zipformer2Ctc" in config) {
        freeConfig(config.zipformer2Ctc, Module);
      }
      if ("feat" in config) {
        freeConfig(config.feat, Module);
      }
      if ("model" in config) {
        freeConfig(config.model, Module);
      }
      if ("nemoCtc" in config) {
        freeConfig(config.nemoCtc, Module);
      }
      if ("toneCtc" in config) {
        freeConfig(config.toneCtc, Module);
      }
      if ("whisper" in config) {
        freeConfig(config.whisper, Module);
      }
      if ("fireRedAsr" in config) {
        freeConfig(config.fireRedAsr, Module);
      }
      if ("dolphin" in config) {
        freeConfig(config.dolphin, Module);
      }
      if ("zipformerCtc" in config) {
        freeConfig(config.zipformerCtc, Module);
      }
      if ("wenetCtc" in config) {
        freeConfig(config.wenetCtc, Module);
      }
      if ("omnilingual" in config) {
        freeConfig(config.omnilingual, Module);
      }
      if ("medasr" in config) {
        freeConfig(config.medasr, Module);
      }
      if ("fireRedAsrCtc" in config) {
        freeConfig(config.fireRedAsrCtc, Module);
      }
      if ("qwen3Asr" in config) {
        freeConfig(config.qwen3Asr, Module);
      }
      if ("funasrNano" in config) {
        freeConfig(config.funasrNano, Module);
      }
      if ("moonshine" in config) {
        freeConfig(config.moonshine, Module);
      }
      if ("tdnn" in config) {
        freeConfig(config.tdnn, Module);
      }
      if ("senseVoice" in config) {
        freeConfig(config.senseVoice, Module);
      }
      if ("canary" in config) {
        freeConfig(config.canary, Module);
      }
      if ("lm" in config) {
        freeConfig(config.lm, Module);
      }
      if ("ctcFstDecoder" in config) {
        freeConfig(config.ctcFstDecoder, Module);
      }
      if ("hr" in config) {
        freeConfig(config.hr, Module);
      }
      Module._free(config.ptr);
    }
    function initSherpaOnnxOnlineTransducerModelConfig(config, Module) {
      const encoderLen = Module.lengthBytesUTF8(config.encoder || "") + 1;
      const decoderLen = Module.lengthBytesUTF8(config.decoder || "") + 1;
      const joinerLen = Module.lengthBytesUTF8(config.joiner || "") + 1;
      const n = encoderLen + decoderLen + joinerLen;
      const buffer = Module._malloc(n);
      const len = 3 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(config.encoder || "", buffer + offset, encoderLen);
      offset += encoderLen;
      Module.stringToUTF8(config.decoder || "", buffer + offset, decoderLen);
      offset += decoderLen;
      Module.stringToUTF8(config.joiner || "", buffer + offset, joinerLen);
      offset = 0;
      Module.setValue(ptr, buffer + offset, "i8*");
      offset += encoderLen;
      Module.setValue(ptr + 4, buffer + offset, "i8*");
      offset += decoderLen;
      Module.setValue(ptr + 8, buffer + offset, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOnlineParaformerModelConfig(config, Module) {
      const encoderLen = Module.lengthBytesUTF8(config.encoder || "") + 1;
      const decoderLen = Module.lengthBytesUTF8(config.decoder || "") + 1;
      const n = encoderLen + decoderLen;
      const buffer = Module._malloc(n);
      const len = 2 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(config.encoder || "", buffer + offset, encoderLen);
      offset += encoderLen;
      Module.stringToUTF8(config.decoder || "", buffer + offset, decoderLen);
      offset = 0;
      Module.setValue(ptr, buffer + offset, "i8*");
      offset += encoderLen;
      Module.setValue(ptr + 4, buffer + offset, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOnlineZipformer2CtcModelConfig(config, Module) {
      const n = Module.lengthBytesUTF8(config.model || "") + 1;
      const buffer = Module._malloc(n);
      const len = 1 * 4;
      const ptr = Module._malloc(len);
      Module.stringToUTF8(config.model || "", buffer, n);
      Module.setValue(ptr, buffer, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOnlineNemoCtcModelConfig(config, Module) {
      const n = Module.lengthBytesUTF8(config.model || "") + 1;
      const buffer = Module._malloc(n);
      const len = 1 * 4;
      const ptr = Module._malloc(len);
      Module.stringToUTF8(config.model || "", buffer, n);
      Module.setValue(ptr, buffer, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOnlineToneCtcModelConfig(config, Module) {
      const n = Module.lengthBytesUTF8(config.model || "") + 1;
      const buffer = Module._malloc(n);
      const len = 1 * 4;
      const ptr = Module._malloc(len);
      Module.stringToUTF8(config.model || "", buffer, n);
      Module.setValue(ptr, buffer, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOnlineModelConfig(config, Module) {
      if (!("transducer" in config)) {
        config.transducer = {
          encoder: "",
          decoder: "",
          joiner: ""
        };
      }
      if (!("paraformer" in config)) {
        config.paraformer = {
          encoder: "",
          decoder: ""
        };
      }
      if (!("zipformer2Ctc" in config)) {
        config.zipformer2Ctc = {
          model: ""
        };
      }
      if (!("nemoCtc" in config)) {
        config.nemoCtc = {
          model: ""
        };
      }
      if (!("toneCtc" in config)) {
        config.toneCtc = {
          model: ""
        };
      }
      if (!("tokensBuf" in config)) {
        config.tokensBuf = "";
      }
      if (!("tokensBufSize" in config)) {
        config.tokensBufSize = 0;
      }
      const transducer = initSherpaOnnxOnlineTransducerModelConfig(config.transducer, Module);
      const paraformer = initSherpaOnnxOnlineParaformerModelConfig(config.paraformer, Module);
      const zipformer2Ctc = initSherpaOnnxOnlineZipformer2CtcModelConfig(
        config.zipformer2Ctc,
        Module
      );
      const nemoCtc = initSherpaOnnxOnlineNemoCtcModelConfig(config.nemoCtc, Module);
      const toneCtc = initSherpaOnnxOnlineToneCtcModelConfig(config.toneCtc, Module);
      const len = transducer.len + paraformer.len + zipformer2Ctc.len + 9 * 4 + nemoCtc.len + toneCtc.len;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module._CopyHeap(transducer.ptr, transducer.len, ptr + offset);
      offset += transducer.len;
      Module._CopyHeap(paraformer.ptr, paraformer.len, ptr + offset);
      offset += paraformer.len;
      Module._CopyHeap(zipformer2Ctc.ptr, zipformer2Ctc.len, ptr + offset);
      offset += zipformer2Ctc.len;
      const tokensLen = Module.lengthBytesUTF8(config.tokens || "") + 1;
      const providerLen = Module.lengthBytesUTF8(config.provider || "cpu") + 1;
      const modelTypeLen = Module.lengthBytesUTF8(config.modelType || "") + 1;
      const modelingUnitLen = Module.lengthBytesUTF8(config.modelingUnit || "") + 1;
      const bpeVocabLen = Module.lengthBytesUTF8(config.bpeVocab || "") + 1;
      const tokensBufLen = Module.lengthBytesUTF8(config.tokensBuf || "") + 1;
      const bufferLen = tokensLen + providerLen + modelTypeLen + modelingUnitLen + bpeVocabLen + tokensBufLen;
      const buffer = Module._malloc(bufferLen);
      offset = 0;
      Module.stringToUTF8(config.tokens || "", buffer, tokensLen);
      offset += tokensLen;
      Module.stringToUTF8(config.provider || "cpu", buffer + offset, providerLen);
      offset += providerLen;
      Module.stringToUTF8(config.modelType || "", buffer + offset, modelTypeLen);
      offset += modelTypeLen;
      Module.stringToUTF8(
        config.modelingUnit || "",
        buffer + offset,
        modelingUnitLen
      );
      offset += modelingUnitLen;
      Module.stringToUTF8(config.bpeVocab || "", buffer + offset, bpeVocabLen);
      offset += bpeVocabLen;
      Module.stringToUTF8(config.tokensBuf || "", buffer + offset, tokensBufLen);
      offset += tokensBufLen;
      offset = transducer.len + paraformer.len + zipformer2Ctc.len;
      Module.setValue(ptr + offset, buffer, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.numThreads || 1, "i32");
      offset += 4;
      Module.setValue(ptr + offset, buffer + tokensLen, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.debug ?? 1, "i32");
      offset += 4;
      Module.setValue(
        ptr + offset,
        buffer + tokensLen + providerLen,
        "i8*"
      );
      offset += 4;
      Module.setValue(
        ptr + offset,
        buffer + tokensLen + providerLen + modelTypeLen,
        "i8*"
      );
      offset += 4;
      Module.setValue(
        ptr + offset,
        buffer + tokensLen + providerLen + modelTypeLen + modelingUnitLen,
        "i8*"
      );
      offset += 4;
      Module.setValue(
        ptr + offset,
        buffer + tokensLen + providerLen + modelTypeLen + modelingUnitLen + bpeVocabLen,
        "i8*"
      );
      offset += 4;
      Module.setValue(ptr + offset, config.tokensBufSize || 0, "i32");
      offset += 4;
      Module._CopyHeap(nemoCtc.ptr, nemoCtc.len, ptr + offset);
      offset += nemoCtc.len;
      Module._CopyHeap(toneCtc.ptr, toneCtc.len, ptr + offset);
      offset += toneCtc.len;
      return {
        buffer,
        ptr,
        len,
        transducer,
        paraformer,
        zipformer2Ctc,
        nemoCtc,
        toneCtc
      };
    }
    function initSherpaOnnxFeatureConfig(config, Module) {
      const len = 2 * 4;
      const ptr = Module._malloc(len);
      Module.setValue(ptr, config.sampleRate || 16e3, "i32");
      Module.setValue(ptr + 4, config.featureDim || 80, "i32");
      return { ptr, len };
    }
    function initSherpaOnnxHomophoneReplacerConfig(config, Module) {
      const len = 3 * 4;
      const ptr = Module._malloc(len);
      const dictDir = "";
      const dictDirLen = Module.lengthBytesUTF8(dictDir) + 1;
      const lexiconLen = Module.lengthBytesUTF8(config.lexicon || "") + 1;
      const ruleFstsLen = Module.lengthBytesUTF8(config.ruleFsts || "") + 1;
      const bufferLen = dictDirLen + lexiconLen + ruleFstsLen;
      const buffer = Module._malloc(bufferLen);
      let offset = 0;
      Module.stringToUTF8(dictDir, buffer + offset, dictDirLen);
      offset += dictDirLen;
      Module.stringToUTF8(config.lexicon || "", buffer + offset, lexiconLen);
      offset += lexiconLen;
      Module.stringToUTF8(config.ruleFsts || "", buffer + offset, ruleFstsLen);
      offset += ruleFstsLen;
      Module.setValue(ptr, buffer, "i8*");
      Module.setValue(ptr + 4, buffer + dictDirLen, "i8*");
      Module.setValue(ptr + 8, buffer + dictDirLen + lexiconLen, "i8*");
      return { ptr, len, buffer };
    }
    function initSherpaOnnxOnlineCtcFstDecoderConfig(config, Module) {
      const len = 2 * 4;
      const ptr = Module._malloc(len);
      const graphLen = Module.lengthBytesUTF8(config.graph || "") + 1;
      const buffer = Module._malloc(graphLen);
      Module.stringToUTF8(config.graph, buffer, graphLen);
      Module.setValue(ptr, buffer, "i8*");
      Module.setValue(ptr + 4, config.maxActive || 3e3, "i32");
      return { ptr, len, buffer };
    }
    function initSherpaOnnxOnlineRecognizerConfig(config, Module) {
      if (!("featConfig" in config)) {
        config.featConfig = {
          sampleRate: 16e3,
          featureDim: 80
        };
      }
      if (!("ctcFstDecoderConfig" in config)) {
        config.ctcFstDecoderConfig = {
          graph: "",
          maxActive: 3e3
        };
      }
      if (!("hotwordsBuf" in config)) {
        config.hotwordsBuf = "";
      }
      if (!("hotwordsBufSize" in config)) {
        config.hotwordsBufSize = 0;
      }
      if (!("hr" in config)) {
        config.hr = {
          lexicon: "",
          ruleFsts: ""
        };
      }
      const feat = initSherpaOnnxFeatureConfig(config.featConfig, Module);
      const model = initSherpaOnnxOnlineModelConfig(config.modelConfig, Module);
      const ctcFstDecoder = initSherpaOnnxOnlineCtcFstDecoderConfig(
        config.ctcFstDecoderConfig,
        Module
      );
      const hr = initSherpaOnnxHomophoneReplacerConfig(config.hr, Module);
      const len = feat.len + model.len + 8 * 4 + ctcFstDecoder.len + 5 * 4 + hr.len;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module._CopyHeap(feat.ptr, feat.len, ptr + offset);
      offset += feat.len;
      Module._CopyHeap(model.ptr, model.len, ptr + offset);
      offset += model.len;
      const decodingMethodLen = Module.lengthBytesUTF8(config.decodingMethod || "greedy_search") + 1;
      const hotwordsFileLen = Module.lengthBytesUTF8(config.hotwordsFile || "") + 1;
      const ruleFstsFileLen = Module.lengthBytesUTF8(config.ruleFsts || "") + 1;
      const ruleFarsFileLen = Module.lengthBytesUTF8(config.ruleFars || "") + 1;
      const hotwordsBufLen = Module.lengthBytesUTF8(config.hotwordsBuf || "") + 1;
      const bufferLen = decodingMethodLen + hotwordsFileLen + ruleFstsFileLen + ruleFarsFileLen + hotwordsBufLen;
      const buffer = Module._malloc(bufferLen);
      offset = 0;
      Module.stringToUTF8(
        config.decodingMethod || "greedy_search",
        buffer,
        decodingMethodLen
      );
      offset += decodingMethodLen;
      Module.stringToUTF8(
        config.hotwordsFile || "",
        buffer + offset,
        hotwordsFileLen
      );
      offset += hotwordsFileLen;
      Module.stringToUTF8(config.ruleFsts || "", buffer + offset, ruleFstsFileLen);
      offset += ruleFstsFileLen;
      Module.stringToUTF8(config.ruleFars || "", buffer + offset, ruleFarsFileLen);
      offset += ruleFarsFileLen;
      Module.stringToUTF8(
        config.hotwordsBuf || "",
        buffer + offset,
        hotwordsBufLen
      );
      offset += hotwordsBufLen;
      offset = feat.len + model.len;
      Module.setValue(ptr + offset, buffer, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.maxActivePaths || 4, "i32");
      offset += 4;
      Module.setValue(ptr + offset, config.enableEndpoint || 0, "i32");
      offset += 4;
      Module.setValue(ptr + offset, config.rule1MinTrailingSilence || 2.4, "float");
      offset += 4;
      Module.setValue(ptr + offset, config.rule2MinTrailingSilence || 1.2, "float");
      offset += 4;
      Module.setValue(ptr + offset, config.rule3MinUtteranceLength || 20, "float");
      offset += 4;
      Module.setValue(ptr + offset, buffer + decodingMethodLen, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.hotwordsScore || 1.5, "float");
      offset += 4;
      Module._CopyHeap(ctcFstDecoder.ptr, ctcFstDecoder.len, ptr + offset);
      offset += ctcFstDecoder.len;
      Module.setValue(
        ptr + offset,
        buffer + decodingMethodLen + hotwordsFileLen,
        "i8*"
      );
      offset += 4;
      Module.setValue(
        ptr + offset,
        buffer + decodingMethodLen + hotwordsFileLen + ruleFstsFileLen,
        "i8*"
      );
      offset += 4;
      Module.setValue(ptr + offset, config.blankPenalty || 0, "float");
      offset += 4;
      Module.setValue(
        ptr + offset,
        buffer + decodingMethodLen + hotwordsFileLen + ruleFstsFileLen + ruleFarsFileLen,
        "i8*"
      );
      offset += 4;
      Module.setValue(ptr + offset, config.hotwordsBufSize || 0, "i32");
      offset += 4;
      Module._CopyHeap(hr.ptr, hr.len, ptr + offset);
      offset += hr.len;
      return {
        buffer,
        ptr,
        len,
        feat,
        model,
        ctcFstDecoder,
        hr
      };
    }
    function createOnlineRecognizer(Module, myConfig) {
      const onlineTransducerModelConfig = {
        encoder: "",
        decoder: "",
        joiner: ""
      };
      const onlineParaformerModelConfig = {
        encoder: "",
        decoder: ""
      };
      const onlineZipformer2CtcModelConfig = {
        model: ""
      };
      const onlineNemoCtcModelConfig = {
        model: ""
      };
      const onlineToneCtcModelConfig = {
        model: ""
      };
      let type = 0;
      switch (type) {
        case 0:
          onlineTransducerModelConfig.encoder = "./encoder.onnx";
          onlineTransducerModelConfig.decoder = "./decoder.onnx";
          onlineTransducerModelConfig.joiner = "./joiner.onnx";
          break;
        case 1:
          onlineParaformerModelConfig.encoder = "./encoder.onnx";
          onlineParaformerModelConfig.decoder = "./decoder.onnx";
          break;
        case 2:
          onlineZipformer2CtcModelConfig.model = "./encoder.onnx";
          break;
        case 3:
          onlineNemoCtcModelConfig.model = "./nemo-ctc.onnx";
          break;
        case 4:
          onlineToneCtcModelConfig.model = "./tone-ctc.onnx";
          break;
      }
      const onlineModelConfig = {
        transducer: onlineTransducerModelConfig,
        paraformer: onlineParaformerModelConfig,
        zipformer2Ctc: onlineZipformer2CtcModelConfig,
        nemoCtc: onlineNemoCtcModelConfig,
        toneCtc: onlineToneCtcModelConfig,
        tokens: "./tokens.txt",
        numThreads: 1,
        provider: "cpu",
        debug: 1,
        modelType: "",
        modelingUnit: "cjkchar",
        bpeVocab: ""
      };
      const featureConfig = {
        sampleRate: 16e3,
        // it is ignored when toneCtc is used
        featureDim: 80
        // it is ignored when toneCtc is used
      };
      let recognizerConfig = {
        featConfig: featureConfig,
        modelConfig: onlineModelConfig,
        decodingMethod: "greedy_search",
        maxActivePaths: 4,
        enableEndpoint: 1,
        rule1MinTrailingSilence: 2.4,
        rule2MinTrailingSilence: 1.2,
        rule3MinUtteranceLength: 20,
        hotwordsFile: "",
        hotwordsScore: 1.5,
        ctcFstDecoderConfig: {
          graph: "",
          maxActive: 3e3
        },
        ruleFsts: "",
        ruleFars: ""
      };
      if (myConfig) {
        recognizerConfig = myConfig;
      }
      return new OnlineRecognizer(recognizerConfig, Module);
    }
    function initSherpaOnnxOfflineTransducerModelConfig(config, Module) {
      const encoderLen = Module.lengthBytesUTF8(config.encoder || "") + 1;
      const decoderLen = Module.lengthBytesUTF8(config.decoder || "") + 1;
      const joinerLen = Module.lengthBytesUTF8(config.joiner || "") + 1;
      const n = encoderLen + decoderLen + joinerLen;
      const buffer = Module._malloc(n);
      const len = 3 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(config.encoder || "", buffer + offset, encoderLen);
      offset += encoderLen;
      Module.stringToUTF8(config.decoder || "", buffer + offset, decoderLen);
      offset += decoderLen;
      Module.stringToUTF8(config.joiner || "", buffer + offset, joinerLen);
      offset = 0;
      Module.setValue(ptr, buffer + offset, "i8*");
      offset += encoderLen;
      Module.setValue(ptr + 4, buffer + offset, "i8*");
      offset += decoderLen;
      Module.setValue(ptr + 8, buffer + offset, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineParaformerModelConfig(config, Module) {
      const n = Module.lengthBytesUTF8(config.model || "") + 1;
      const buffer = Module._malloc(n);
      const len = 1 * 4;
      const ptr = Module._malloc(len);
      Module.stringToUTF8(config.model || "", buffer, n);
      Module.setValue(ptr, buffer, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineNemoEncDecCtcModelConfig(config, Module) {
      const n = Module.lengthBytesUTF8(config.model || "") + 1;
      const buffer = Module._malloc(n);
      const len = 1 * 4;
      const ptr = Module._malloc(len);
      Module.stringToUTF8(config.model || "", buffer, n);
      Module.setValue(ptr, buffer, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineDolphinModelConfig(config, Module) {
      const n = Module.lengthBytesUTF8(config.model || "") + 1;
      const buffer = Module._malloc(n);
      const len = 1 * 4;
      const ptr = Module._malloc(len);
      Module.stringToUTF8(config.model || "", buffer, n);
      Module.setValue(ptr, buffer, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineZipformerCtcModelConfig(config, Module) {
      const n = Module.lengthBytesUTF8(config.model || "") + 1;
      const buffer = Module._malloc(n);
      const len = 1 * 4;
      const ptr = Module._malloc(len);
      Module.stringToUTF8(config.model || "", buffer, n);
      Module.setValue(ptr, buffer, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineWenetCtcModelConfig(config, Module) {
      const n = Module.lengthBytesUTF8(config.model || "") + 1;
      const buffer = Module._malloc(n);
      const len = 1 * 4;
      const ptr = Module._malloc(len);
      Module.stringToUTF8(config.model || "", buffer, n);
      Module.setValue(ptr, buffer, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineOmnilingualAsrCtcModelConfig(config, Module) {
      const n = Module.lengthBytesUTF8(config.model || "") + 1;
      const buffer = Module._malloc(n);
      const len = 1 * 4;
      const ptr = Module._malloc(len);
      Module.stringToUTF8(config.model || "", buffer, n);
      Module.setValue(ptr, buffer, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineMedAsrCtcModelConfig(config, Module) {
      const n = Module.lengthBytesUTF8(config.model || "") + 1;
      const buffer = Module._malloc(n);
      const len = 1 * 4;
      const ptr = Module._malloc(len);
      Module.stringToUTF8(config.model || "", buffer, n);
      Module.setValue(ptr, buffer, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineFireRedAsrCtcModelConfig(config, Module) {
      const n = Module.lengthBytesUTF8(config.model || "") + 1;
      const buffer = Module._malloc(n);
      const len = 1 * 4;
      const ptr = Module._malloc(len);
      Module.stringToUTF8(config.model || "", buffer, n);
      Module.setValue(ptr, buffer, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineFunAsrNanoModelConfig(config, Module) {
      const encoderAdaptorLen = Module.lengthBytesUTF8(config.encoderAdaptor || "") + 1;
      const llmLen = Module.lengthBytesUTF8(config.llm || "") + 1;
      const embeddingLen = Module.lengthBytesUTF8(config.embedding || "") + 1;
      const tokenizerLen = Module.lengthBytesUTF8(config.tokenizer || "") + 1;
      const systemPromptLen = Module.lengthBytesUTF8(
        config.systemPrompt || "You are a helpful assistant."
      ) + 1;
      const userPromptLen = Module.lengthBytesUTF8(config.userPrompt || "\u8BED\u97F3\u8F6C\u5199\uFF1A") + 1;
      const languageLen = Module.lengthBytesUTF8(config.language || "") + 1;
      const hotwordsLen = Module.lengthBytesUTF8(config.hotwords || "") + 1;
      const n = encoderAdaptorLen + llmLen + embeddingLen + tokenizerLen + systemPromptLen + userPromptLen + languageLen + hotwordsLen;
      const buffer = Module._malloc(n);
      const len = 13 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(
        config.encoderAdaptor || "",
        buffer + offset,
        encoderAdaptorLen
      );
      offset += encoderAdaptorLen;
      Module.stringToUTF8(config.llm || "", buffer + offset, llmLen);
      offset += llmLen;
      Module.stringToUTF8(config.embedding || "", buffer + offset, embeddingLen);
      offset += embeddingLen;
      Module.stringToUTF8(config.tokenizer || "", buffer + offset, tokenizerLen);
      offset += tokenizerLen;
      Module.stringToUTF8(
        config.systemPrompt || "You are a helpful assistant.",
        buffer + offset,
        systemPromptLen
      );
      offset += systemPromptLen;
      Module.stringToUTF8(
        config.userPrompt || "\u8BED\u97F3\u8F6C\u5199\uFF1A",
        buffer + offset,
        userPromptLen
      );
      offset += userPromptLen;
      Module.stringToUTF8(config.language || "", buffer + offset, languageLen);
      offset += languageLen;
      Module.stringToUTF8(config.hotwords || "", buffer + offset, hotwordsLen);
      offset += hotwordsLen;
      offset = 0;
      Module.setValue(ptr + 0 * 4, buffer + offset, "i8*");
      offset += encoderAdaptorLen;
      Module.setValue(ptr + 1 * 4, buffer + offset, "i8*");
      offset += llmLen;
      Module.setValue(ptr + 2 * 4, buffer + offset, "i8*");
      offset += embeddingLen;
      Module.setValue(ptr + 3 * 4, buffer + offset, "i8*");
      offset += tokenizerLen;
      Module.setValue(ptr + 4 * 4, buffer + offset, "i8*");
      offset += systemPromptLen;
      Module.setValue(ptr + 5 * 4, buffer + offset, "i8*");
      offset += userPromptLen;
      Module.setValue(ptr + 6 * 4, config.maxNewTokens || 512, "i32");
      Module.setValue(ptr + 7 * 4, config.temperature || 1e-6, "float");
      Module.setValue(ptr + 8 * 4, config.topP || 0.8, "float");
      Module.setValue(ptr + 9 * 4, config.seed || 42, "i32");
      Module.setValue(ptr + 10 * 4, buffer + offset, "i8*");
      offset += languageLen;
      Module.setValue(ptr + 11 * 4, config.itn || 0, "i32");
      Module.setValue(ptr + 12 * 4, buffer + offset, "i8*");
      offset += hotwordsLen;
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineQwen3AsrModelConfig(config, Module) {
      const convFrontendLen = Module.lengthBytesUTF8(config.convFrontend || "") + 1;
      const encoderLen = Module.lengthBytesUTF8(config.encoder || "") + 1;
      const decoderLen = Module.lengthBytesUTF8(config.decoder || "") + 1;
      const tokenizerLen = Module.lengthBytesUTF8(config.tokenizer || "") + 1;
      const n = convFrontendLen + encoderLen + decoderLen + tokenizerLen;
      const buffer = Module._malloc(n);
      const len = 9 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(
        config.convFrontend || "",
        buffer + offset,
        convFrontendLen
      );
      offset += convFrontendLen;
      Module.stringToUTF8(config.encoder || "", buffer + offset, encoderLen);
      offset += encoderLen;
      Module.stringToUTF8(config.decoder || "", buffer + offset, decoderLen);
      offset += decoderLen;
      Module.stringToUTF8(config.tokenizer || "", buffer + offset, tokenizerLen);
      offset += tokenizerLen;
      offset = 0;
      Module.setValue(ptr + 0 * 4, buffer + offset, "i8*");
      offset += convFrontendLen;
      Module.setValue(ptr + 1 * 4, buffer + offset, "i8*");
      offset += encoderLen;
      Module.setValue(ptr + 2 * 4, buffer + offset, "i8*");
      offset += decoderLen;
      Module.setValue(ptr + 3 * 4, buffer + offset, "i8*");
      offset += tokenizerLen;
      Module.setValue(ptr + 4 * 4, config.maxTotalLen || 512, "i32");
      Module.setValue(ptr + 5 * 4, config.maxNewTokens || 128, "i32");
      Module.setValue(ptr + 6 * 4, config.temperature || 1e-6, "float");
      Module.setValue(ptr + 7 * 4, config.topP || 0.8, "float");
      Module.setValue(ptr + 8 * 4, config.seed || 42, "i32");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineWhisperModelConfig(config, Module) {
      const encoderLen = Module.lengthBytesUTF8(config.encoder || "") + 1;
      const decoderLen = Module.lengthBytesUTF8(config.decoder || "") + 1;
      const languageLen = Module.lengthBytesUTF8(config.language || "") + 1;
      const taskLen = Module.lengthBytesUTF8(config.task || "") + 1;
      const n = encoderLen + decoderLen + languageLen + taskLen;
      const buffer = Module._malloc(n);
      const len = 7 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(config.encoder || "", buffer + offset, encoderLen);
      offset += encoderLen;
      Module.stringToUTF8(config.decoder || "", buffer + offset, decoderLen);
      offset += decoderLen;
      Module.stringToUTF8(config.language || "", buffer + offset, languageLen);
      offset += languageLen;
      Module.stringToUTF8(config.task || "", buffer + offset, taskLen);
      offset = 0;
      Module.setValue(ptr, buffer + offset, "i8*");
      offset += encoderLen;
      Module.setValue(ptr + 4, buffer + offset, "i8*");
      offset += decoderLen;
      Module.setValue(ptr + 8, buffer + offset, "i8*");
      offset += languageLen;
      Module.setValue(ptr + 12, buffer + offset, "i8*");
      offset += taskLen;
      Module.setValue(ptr + 16, config.tailPaddings || 2e3, "i32");
      Module.setValue(ptr + 20, config.enableTokenTimestamps || 0, "i32");
      Module.setValue(ptr + 24, config.enableSegmentTimestamps || 0, "i32");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineCanaryModelConfig(config, Module) {
      const encoderLen = Module.lengthBytesUTF8(config.encoder || "") + 1;
      const decoderLen = Module.lengthBytesUTF8(config.decoder || "") + 1;
      const srcLangLen = Module.lengthBytesUTF8(config.srcLang || "") + 1;
      const tgtLangLen = Module.lengthBytesUTF8(config.tgtLang || "") + 1;
      const n = encoderLen + decoderLen + srcLangLen + tgtLangLen;
      const buffer = Module._malloc(n);
      const len = 5 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(config.encoder || "", buffer + offset, encoderLen);
      offset += encoderLen;
      Module.stringToUTF8(config.decoder || "", buffer + offset, decoderLen);
      offset += decoderLen;
      Module.stringToUTF8(config.srcLang || "", buffer + offset, srcLangLen);
      offset += srcLangLen;
      Module.stringToUTF8(config.tgtLang || "", buffer + offset, tgtLangLen);
      offset += tgtLangLen;
      offset = 0;
      Module.setValue(ptr, buffer + offset, "i8*");
      offset += encoderLen;
      Module.setValue(ptr + 4, buffer + offset, "i8*");
      offset += decoderLen;
      Module.setValue(ptr + 8, buffer + offset, "i8*");
      offset += srcLangLen;
      Module.setValue(ptr + 12, buffer + offset, "i8*");
      offset += tgtLangLen;
      Module.setValue(ptr + 16, config.usePnc ?? 1, "i32");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineMoonshineModelConfig(config, Module) {
      const preprocessorLen = Module.lengthBytesUTF8(config.preprocessor || "") + 1;
      const encoderLen = Module.lengthBytesUTF8(config.encoder || "") + 1;
      const uncachedDecoderLen = Module.lengthBytesUTF8(config.uncachedDecoder || "") + 1;
      const cachedDecoderLen = Module.lengthBytesUTF8(config.cachedDecoder || "") + 1;
      const mergedDecoderLen = Module.lengthBytesUTF8(config.mergedDecoder || "") + 1;
      const n = preprocessorLen + encoderLen + uncachedDecoderLen + cachedDecoderLen + mergedDecoderLen;
      const buffer = Module._malloc(n);
      const len = 5 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(
        config.preprocessor || "",
        buffer + offset,
        preprocessorLen
      );
      offset += preprocessorLen;
      Module.stringToUTF8(config.encoder || "", buffer + offset, encoderLen);
      offset += encoderLen;
      Module.stringToUTF8(
        config.uncachedDecoder || "",
        buffer + offset,
        uncachedDecoderLen
      );
      offset += uncachedDecoderLen;
      Module.stringToUTF8(
        config.cachedDecoder || "",
        buffer + offset,
        cachedDecoderLen
      );
      offset += cachedDecoderLen;
      Module.stringToUTF8(
        config.mergedDecoder || "",
        buffer + offset,
        mergedDecoderLen
      );
      offset += mergedDecoderLen;
      offset = 0;
      Module.setValue(ptr, buffer + offset, "i8*");
      offset += preprocessorLen;
      Module.setValue(ptr + 4, buffer + offset, "i8*");
      offset += encoderLen;
      Module.setValue(ptr + 8, buffer + offset, "i8*");
      offset += uncachedDecoderLen;
      Module.setValue(ptr + 12, buffer + offset, "i8*");
      offset += cachedDecoderLen;
      Module.setValue(ptr + 16, buffer + offset, "i8*");
      offset += mergedDecoderLen;
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineFireRedAsrModelConfig(config, Module) {
      const encoderLen = Module.lengthBytesUTF8(config.encoder || "") + 1;
      const decoderLen = Module.lengthBytesUTF8(config.decoder || "") + 1;
      const n = encoderLen + decoderLen;
      const buffer = Module._malloc(n);
      const len = 2 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(config.encoder || "", buffer + offset, encoderLen);
      offset += encoderLen;
      Module.stringToUTF8(config.decoder || "", buffer + offset, decoderLen);
      offset += decoderLen;
      offset = 0;
      Module.setValue(ptr, buffer + offset, "i8*");
      offset += encoderLen;
      Module.setValue(ptr + 4, buffer + offset, "i8*");
      offset += decoderLen;
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineTdnnModelConfig(config, Module) {
      const n = Module.lengthBytesUTF8(config.model || "") + 1;
      const buffer = Module._malloc(n);
      const len = 1 * 4;
      const ptr = Module._malloc(len);
      Module.stringToUTF8(config.model || "", buffer, n);
      Module.setValue(ptr, buffer, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineSenseVoiceModelConfig(config, Module) {
      const modelLen = Module.lengthBytesUTF8(config.model || "") + 1;
      const languageLen = Module.lengthBytesUTF8(config.language || "") + 1;
      const n = modelLen + languageLen;
      const buffer = Module._malloc(n);
      const len = 3 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(config.model || "", buffer + offset, modelLen);
      offset += modelLen;
      Module.stringToUTF8(config.language || "", buffer + offset, languageLen);
      offset += languageLen;
      offset = 0;
      Module.setValue(ptr, buffer + offset, "i8*");
      offset += modelLen;
      Module.setValue(ptr + 4, buffer + offset, "i8*");
      offset += languageLen;
      Module.setValue(ptr + 8, config.useInverseTextNormalization ?? 0, "i32");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineLMConfig(config, Module) {
      const n = Module.lengthBytesUTF8(config.model || "") + 1;
      const buffer = Module._malloc(n);
      const len = 2 * 4;
      const ptr = Module._malloc(len);
      Module.stringToUTF8(config.model || "", buffer, n);
      Module.setValue(ptr, buffer, "i8*");
      Module.setValue(ptr + 4, config.scale || 1, "float");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineModelConfig(config, Module) {
      if (!("transducer" in config)) {
        config.transducer = {
          encoder: "",
          decoder: "",
          joiner: ""
        };
      }
      if (!("paraformer" in config)) {
        config.paraformer = {
          model: ""
        };
      }
      if (!("nemoCtc" in config)) {
        config.nemoCtc = {
          model: ""
        };
      }
      if (!("dolphin" in config)) {
        config.dolphin = {
          model: ""
        };
      }
      if (!("zipformerCtc" in config)) {
        config.zipformerCtc = {
          model: ""
        };
      }
      if (!("wenetCtc" in config)) {
        config.wenetCtc = {
          model: ""
        };
      }
      if (!("omnilingual" in config)) {
        config.omnilingual = {
          model: ""
        };
      }
      if (!("medasr" in config)) {
        config.medasr = {
          model: ""
        };
      }
      if (!("fireRedAsrCtc" in config)) {
        config.fireRedAsrCtc = {
          model: ""
        };
      }
      if (!("qwen3Asr" in config)) {
        config.qwen3Asr = {
          convFrontend: "",
          encoder: "",
          decoder: "",
          tokenizer: "",
          maxTotalLen: 512,
          maxNewTokens: 128,
          temperature: 1e-6,
          topP: 0.8,
          seed: 42
        };
      }
      if (!("funasrNano" in config)) {
        config.funasrNano = {
          encoderAdaptor: "",
          llm: "",
          embedding: "",
          tokenizer: "",
          systemPrompt: "You are a helpful assistant.",
          userPrompt: "\u8BED\u97F3\u8F6C\u5199\uFF1A",
          maxNewTokens: 512,
          temperature: 1e-6,
          topP: 0.8,
          seed: 42,
          language: "",
          itn: 0,
          hotwords: ""
        };
      }
      if (!("whisper" in config)) {
        config.whisper = {
          encoder: "",
          decoder: "",
          language: "",
          task: "",
          tailPaddings: -1,
          enableTokenTimestamps: 0,
          enableSegmentTimestamps: 0
        };
      }
      if (!("moonshine" in config)) {
        config.moonshine = {
          preprocessor: "",
          encoder: "",
          uncachedDecoder: "",
          cachedDecoder: "",
          mergedDecoder: ""
        };
      }
      if (!("fireRedAsr" in config)) {
        config.fireRedAsr = {
          encoder: "",
          decoder: ""
        };
      }
      if (!("tdnn" in config)) {
        config.tdnn = {
          model: ""
        };
      }
      if (!("senseVoice" in config)) {
        config.senseVoice = {
          model: "",
          language: "",
          useInverseTextNormalization: 0
        };
      }
      if (!("canary" in config)) {
        config.canary = {
          encoder: "",
          decoder: "",
          srcLang: "",
          tgtLang: "",
          usePnc: 1
        };
      }
      const transducer = initSherpaOnnxOfflineTransducerModelConfig(config.transducer, Module);
      const paraformer = initSherpaOnnxOfflineParaformerModelConfig(config.paraformer, Module);
      const nemoCtc = initSherpaOnnxOfflineNemoEncDecCtcModelConfig(config.nemoCtc, Module);
      const whisper = initSherpaOnnxOfflineWhisperModelConfig(config.whisper, Module);
      const tdnn = initSherpaOnnxOfflineTdnnModelConfig(config.tdnn, Module);
      const senseVoice = initSherpaOnnxOfflineSenseVoiceModelConfig(config.senseVoice, Module);
      const moonshine = initSherpaOnnxOfflineMoonshineModelConfig(config.moonshine, Module);
      const fireRedAsr = initSherpaOnnxOfflineFireRedAsrModelConfig(config.fireRedAsr, Module);
      const dolphin = initSherpaOnnxOfflineDolphinModelConfig(config.dolphin, Module);
      const zipformerCtc = initSherpaOnnxOfflineZipformerCtcModelConfig(config.zipformerCtc, Module);
      const canary = initSherpaOnnxOfflineCanaryModelConfig(config.canary, Module);
      const wenetCtc = initSherpaOnnxOfflineWenetCtcModelConfig(config.wenetCtc, Module);
      const omnilingual = initSherpaOnnxOfflineOmnilingualAsrCtcModelConfig(
        config.omnilingual,
        Module
      );
      const medasr = initSherpaOnnxOfflineMedAsrCtcModelConfig(config.medasr, Module);
      const funasrNano = initSherpaOnnxOfflineFunAsrNanoModelConfig(config.funasrNano, Module);
      const fireRedAsrCtc = initSherpaOnnxOfflineFireRedAsrCtcModelConfig(
        config.fireRedAsrCtc,
        Module
      );
      const qwen3Asr = initSherpaOnnxOfflineQwen3AsrModelConfig(config.qwen3Asr, Module);
      const len = transducer.len + paraformer.len + nemoCtc.len + whisper.len + tdnn.len + 8 * 4 + senseVoice.len + moonshine.len + fireRedAsr.len + dolphin.len + zipformerCtc.len + canary.len + wenetCtc.len + omnilingual.len + medasr.len + funasrNano.len + fireRedAsrCtc.len + qwen3Asr.len;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module._CopyHeap(transducer.ptr, transducer.len, ptr + offset);
      offset += transducer.len;
      Module._CopyHeap(paraformer.ptr, paraformer.len, ptr + offset);
      offset += paraformer.len;
      Module._CopyHeap(nemoCtc.ptr, nemoCtc.len, ptr + offset);
      offset += nemoCtc.len;
      Module._CopyHeap(whisper.ptr, whisper.len, ptr + offset);
      offset += whisper.len;
      Module._CopyHeap(tdnn.ptr, tdnn.len, ptr + offset);
      offset += tdnn.len;
      const tokensLen = Module.lengthBytesUTF8(config.tokens || "") + 1;
      const providerLen = Module.lengthBytesUTF8(config.provider || "cpu") + 1;
      const modelTypeLen = Module.lengthBytesUTF8(config.modelType || "") + 1;
      const modelingUnitLen = Module.lengthBytesUTF8(config.modelingUnit || "") + 1;
      const bpeVocabLen = Module.lengthBytesUTF8(config.bpeVocab || "") + 1;
      const teleSpeechCtcLen = Module.lengthBytesUTF8(config.teleSpeechCtc || "") + 1;
      const bufferLen = tokensLen + providerLen + modelTypeLen + modelingUnitLen + bpeVocabLen + teleSpeechCtcLen;
      const buffer = Module._malloc(bufferLen);
      offset = 0;
      Module.stringToUTF8(config.tokens, buffer, tokensLen);
      offset += tokensLen;
      Module.stringToUTF8(config.provider || "cpu", buffer + offset, providerLen);
      offset += providerLen;
      Module.stringToUTF8(config.modelType || "", buffer + offset, modelTypeLen);
      offset += modelTypeLen;
      Module.stringToUTF8(
        config.modelingUnit || "",
        buffer + offset,
        modelingUnitLen
      );
      offset += modelingUnitLen;
      Module.stringToUTF8(config.bpeVocab || "", buffer + offset, bpeVocabLen);
      offset += bpeVocabLen;
      Module.stringToUTF8(
        config.teleSpeechCtc || "",
        buffer + offset,
        teleSpeechCtcLen
      );
      offset += teleSpeechCtcLen;
      offset = transducer.len + paraformer.len + nemoCtc.len + whisper.len + tdnn.len;
      Module.setValue(ptr + offset, buffer, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.numThreads || 1, "i32");
      offset += 4;
      Module.setValue(ptr + offset, config.debug ?? 1, "i32");
      offset += 4;
      Module.setValue(ptr + offset, buffer + tokensLen, "i8*");
      offset += 4;
      Module.setValue(
        ptr + offset,
        buffer + tokensLen + providerLen,
        "i8*"
      );
      offset += 4;
      Module.setValue(
        ptr + offset,
        buffer + tokensLen + providerLen + modelTypeLen,
        "i8*"
      );
      offset += 4;
      Module.setValue(
        ptr + offset,
        buffer + tokensLen + providerLen + modelTypeLen + modelingUnitLen,
        "i8*"
      );
      offset += 4;
      Module.setValue(
        ptr + offset,
        buffer + tokensLen + providerLen + modelTypeLen + modelingUnitLen + bpeVocabLen,
        "i8*"
      );
      offset += 4;
      Module._CopyHeap(senseVoice.ptr, senseVoice.len, ptr + offset);
      offset += senseVoice.len;
      Module._CopyHeap(moonshine.ptr, moonshine.len, ptr + offset);
      offset += moonshine.len;
      Module._CopyHeap(fireRedAsr.ptr, fireRedAsr.len, ptr + offset);
      offset += fireRedAsr.len;
      Module._CopyHeap(dolphin.ptr, dolphin.len, ptr + offset);
      offset += dolphin.len;
      Module._CopyHeap(zipformerCtc.ptr, zipformerCtc.len, ptr + offset);
      offset += zipformerCtc.len;
      Module._CopyHeap(canary.ptr, canary.len, ptr + offset);
      offset += canary.len;
      Module._CopyHeap(wenetCtc.ptr, wenetCtc.len, ptr + offset);
      offset += wenetCtc.len;
      Module._CopyHeap(omnilingual.ptr, omnilingual.len, ptr + offset);
      offset += omnilingual.len;
      Module._CopyHeap(medasr.ptr, medasr.len, ptr + offset);
      offset += medasr.len;
      Module._CopyHeap(funasrNano.ptr, funasrNano.len, ptr + offset);
      offset += funasrNano.len;
      Module._CopyHeap(fireRedAsrCtc.ptr, fireRedAsrCtc.len, ptr + offset);
      offset += fireRedAsrCtc.len;
      Module._CopyHeap(qwen3Asr.ptr, qwen3Asr.len, ptr + offset);
      offset += qwen3Asr.len;
      return {
        buffer,
        ptr,
        len,
        transducer,
        paraformer,
        nemoCtc,
        whisper,
        tdnn,
        senseVoice,
        moonshine,
        fireRedAsr,
        dolphin,
        zipformerCtc,
        canary,
        wenetCtc,
        omnilingual,
        medasr,
        funasrNano,
        fireRedAsrCtc,
        qwen3Asr
      };
    }
    function initSherpaOnnxOfflineRecognizerConfig(config, Module) {
      if (!("featConfig" in config)) {
        config.featConfig = {
          sampleRate: 16e3,
          featureDim: 80
        };
      }
      if (!("lmConfig" in config)) {
        config.lmConfig = {
          model: "",
          scale: 1
        };
      }
      if (!("hr" in config)) {
        config.hr = {
          lexicon: "",
          ruleFsts: ""
        };
      }
      const feat = initSherpaOnnxFeatureConfig(config.featConfig, Module);
      const model = initSherpaOnnxOfflineModelConfig(config.modelConfig, Module);
      const lm = initSherpaOnnxOfflineLMConfig(config.lmConfig, Module);
      const hr = initSherpaOnnxHomophoneReplacerConfig(config.hr, Module);
      const len = feat.len + model.len + lm.len + 7 * 4 + hr.len;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module._CopyHeap(feat.ptr, feat.len, ptr + offset);
      offset += feat.len;
      Module._CopyHeap(model.ptr, model.len, ptr + offset);
      offset += model.len;
      Module._CopyHeap(lm.ptr, lm.len, ptr + offset);
      offset += lm.len;
      const decodingMethodLen = Module.lengthBytesUTF8(config.decodingMethod || "greedy_search") + 1;
      const hotwordsFileLen = Module.lengthBytesUTF8(config.hotwordsFile || "") + 1;
      const ruleFstsLen = Module.lengthBytesUTF8(config.ruleFsts || "") + 1;
      const ruleFarsLen = Module.lengthBytesUTF8(config.ruleFars || "") + 1;
      const bufferLen = decodingMethodLen + hotwordsFileLen + ruleFstsLen + ruleFarsLen;
      const buffer = Module._malloc(bufferLen);
      offset = 0;
      Module.stringToUTF8(
        config.decodingMethod || "greedy_search",
        buffer,
        decodingMethodLen
      );
      offset += decodingMethodLen;
      Module.stringToUTF8(
        config.hotwordsFile || "",
        buffer + offset,
        hotwordsFileLen
      );
      offset += hotwordsFileLen;
      Module.stringToUTF8(config.ruleFsts || "", buffer + offset, ruleFstsLen);
      offset += ruleFstsLen;
      Module.stringToUTF8(config.ruleFars || "", buffer + offset, ruleFarsLen);
      offset += ruleFarsLen;
      offset = feat.len + model.len + lm.len;
      Module.setValue(ptr + offset, buffer, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.maxActivePaths || 4, "i32");
      offset += 4;
      Module.setValue(ptr + offset, buffer + decodingMethodLen, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.hotwordsScore || 1.5, "float");
      offset += 4;
      Module.setValue(
        ptr + offset,
        buffer + decodingMethodLen + hotwordsFileLen,
        "i8*"
      );
      offset += 4;
      Module.setValue(
        ptr + offset,
        buffer + decodingMethodLen + hotwordsFileLen + ruleFstsLen,
        "i8*"
      );
      offset += 4;
      Module.setValue(ptr + offset, config.blankPenalty || 0, "float");
      offset += 4;
      Module._CopyHeap(hr.ptr, hr.len, ptr + offset);
      offset += hr.len;
      return {
        buffer,
        ptr,
        len,
        feat,
        model,
        lm,
        hr
      };
    }
    var OfflineStream = class {
      constructor(handle, Module) {
        this.handle = handle;
        this.Module = Module;
      }
      free() {
        if (this.handle) {
          this.Module._SherpaOnnxDestroyOfflineStream(this.handle);
          this.handle = null;
        }
      }
      /**
       * @param sampleRate {Number}
       * @param samples {Float32Array} Containing samples in the range [-1, 1]
       */
      acceptWaveform(sampleRate, samples) {
        const pointer = this.Module._malloc(samples.length * samples.BYTES_PER_ELEMENT);
        this.Module.HEAPF32.set(samples, pointer / samples.BYTES_PER_ELEMENT);
        this.Module._SherpaOnnxAcceptWaveformOffline(
          this.handle,
          sampleRate,
          pointer,
          samples.length
        );
        this.Module._free(pointer);
      }
      /**
       * @param key {String} The option name
       * @param value {String} The option value
       */
      setOption(key, value) {
        const keyLen = this.Module.lengthBytesUTF8(key) + 1;
        const valueLen = this.Module.lengthBytesUTF8(value) + 1;
        const pKey = this.Module._malloc(keyLen);
        const pValue = this.Module._malloc(valueLen);
        this.Module.stringToUTF8(key, pKey, keyLen);
        this.Module.stringToUTF8(value, pValue, valueLen);
        this.Module._SherpaOnnxOfflineStreamSetOption(this.handle, pKey, pValue);
        this.Module._free(pKey);
        this.Module._free(pValue);
      }
      /**
       * @param key {String} The option name
       * @returns {String} The option value, or empty string if not set
       */
      getOption(key) {
        const keyLen = this.Module.lengthBytesUTF8(key) + 1;
        const pKey = this.Module._malloc(keyLen);
        this.Module.stringToUTF8(key, pKey, keyLen);
        const pValue = this.Module._SherpaOnnxOfflineStreamGetOption(this.handle, pKey);
        const value = this.Module.UTF8ToString(pValue);
        this.Module._free(pKey);
        return value;
      }
    };
    var OfflineRecognizer = class {
      constructor(configObj, Module) {
        this.config = configObj;
        const config = initSherpaOnnxOfflineRecognizerConfig(configObj, Module);
        const handle = Module._SherpaOnnxCreateOfflineRecognizer(config.ptr);
        freeConfig(config, Module);
        this.handle = handle;
        this.Module = Module;
      }
      setConfig(configObj) {
        const config = initSherpaOnnxOfflineRecognizerConfig(configObj, this.Module);
        this.Module._SherpaOnnxOfflineRecognizerSetConfig(this.handle, config.ptr);
        freeConfig(config, this.Module);
      }
      free() {
        this.Module._SherpaOnnxDestroyOfflineRecognizer(this.handle);
        this.handle = 0;
      }
      createStream() {
        const handle = this.Module._SherpaOnnxCreateOfflineStream(this.handle);
        return new OfflineStream(handle, this.Module);
      }
      decode(stream) {
        this.Module._SherpaOnnxDecodeOfflineStream(this.handle, stream.handle);
      }
      getResult(stream) {
        const r = this.Module._SherpaOnnxGetOfflineStreamResultAsJson(stream.handle);
        const jsonStr = this.Module.UTF8ToString(r);
        const ans = JSON.parse(jsonStr);
        this.Module._SherpaOnnxDestroyOfflineStreamResultJson(r);
        return ans;
      }
    };
    var OnlineStream = class {
      constructor(handle, Module) {
        this.handle = handle;
        this.pointer = null;
        this.n = 0;
        this.Module = Module;
      }
      free() {
        if (this.handle) {
          this.Module._SherpaOnnxDestroyOnlineStream(this.handle);
          this.handle = null;
          this.Module._free(this.pointer);
          this.pointer = null;
          this.n = 0;
        }
      }
      /**
       * @param sampleRate {Number}
       * @param samples {Float32Array} Containing samples in the range [-1, 1]
       */
      acceptWaveform(sampleRate, samples) {
        if (this.n < samples.length) {
          this.Module._free(this.pointer);
          this.pointer = this.Module._malloc(samples.length * samples.BYTES_PER_ELEMENT);
          this.n = samples.length;
        }
        this.Module.HEAPF32.set(samples, this.pointer / samples.BYTES_PER_ELEMENT);
        this.Module._SherpaOnnxOnlineStreamAcceptWaveform(
          this.handle,
          sampleRate,
          this.pointer,
          samples.length
        );
      }
      inputFinished() {
        this.Module._SherpaOnnxOnlineStreamInputFinished(this.handle);
      }
      /**
       * @param key {String} The option name
       * @param value {String} The option value
       */
      setOption(key, value) {
        const keyLen = this.Module.lengthBytesUTF8(key) + 1;
        const valueLen = this.Module.lengthBytesUTF8(value) + 1;
        const pKey = this.Module._malloc(keyLen);
        const pValue = this.Module._malloc(valueLen);
        this.Module.stringToUTF8(key, pKey, keyLen);
        this.Module.stringToUTF8(value, pValue, valueLen);
        this.Module._SherpaOnnxOnlineStreamSetOption(this.handle, pKey, pValue);
        this.Module._free(pKey);
        this.Module._free(pValue);
      }
      /**
       * @param key {String} The option name
       * @returns {String} The option value, or empty string if not set
       */
      getOption(key) {
        const keyLen = this.Module.lengthBytesUTF8(key) + 1;
        const pKey = this.Module._malloc(keyLen);
        this.Module.stringToUTF8(key, pKey, keyLen);
        const pValue = this.Module._SherpaOnnxOnlineStreamGetOption(this.handle, pKey);
        const value = this.Module.UTF8ToString(pValue);
        this.Module._free(pKey);
        return value;
      }
    };
    var OnlineRecognizer = class {
      constructor(configObj, Module) {
        this.config = configObj;
        const config = initSherpaOnnxOnlineRecognizerConfig(configObj, Module);
        const handle = Module._SherpaOnnxCreateOnlineRecognizer(config.ptr);
        freeConfig(config, Module);
        this.handle = handle;
        this.Module = Module;
      }
      free() {
        this.Module._SherpaOnnxDestroyOnlineRecognizer(this.handle);
        this.handle = 0;
      }
      createStream() {
        const handle = this.Module._SherpaOnnxCreateOnlineStream(this.handle);
        return new OnlineStream(handle, this.Module);
      }
      isReady(stream) {
        return this.Module._SherpaOnnxIsOnlineStreamReady(
          this.handle,
          stream.handle
        ) == 1;
      }
      decode(stream) {
        this.Module._SherpaOnnxDecodeOnlineStream(this.handle, stream.handle);
      }
      isEndpoint(stream) {
        return this.Module._SherpaOnnxOnlineStreamIsEndpoint(
          this.handle,
          stream.handle
        ) == 1;
      }
      reset(stream) {
        this.Module._SherpaOnnxOnlineStreamReset(this.handle, stream.handle);
      }
      getResult(stream) {
        const r = this.Module._SherpaOnnxGetOnlineStreamResultAsJson(
          this.handle,
          stream.handle
        );
        const jsonStr = this.Module.UTF8ToString(r);
        const ans = JSON.parse(jsonStr);
        this.Module._SherpaOnnxDestroyOnlineStreamResultJson(r);
        return ans;
      }
    };
    if (typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string") {
      module2.exports = {
        createOnlineRecognizer,
        OfflineRecognizer
      };
    }
  }
});

// node_modules/sherpa-onnx/sherpa-onnx-tts.js
var require_sherpa_onnx_tts = __commonJS({
  "node_modules/sherpa-onnx/sherpa-onnx-tts.js"(exports2, module2) {
    function freeConfig(config, Module) {
      if ("buffer" in config) {
        Module._free(config.buffer);
      }
      if ("config" in config) {
        freeConfig(config.config, Module);
      }
      if ("matcha" in config) {
        freeConfig(config.matcha, Module);
      }
      if ("kokoro" in config) {
        freeConfig(config.kokoro, Module);
      }
      if ("kitten" in config) {
        freeConfig(config.kitten, Module);
      }
      if ("zipvoice" in config) {
        freeConfig(config.zipvoice, Module);
      }
      if ("pocket" in config) {
        freeConfig(config.pocket, Module);
      }
      if ("supertonic" in config) {
        freeConfig(config.supertonic, Module);
      }
      if (config.ptr) {
        Module._free(config.ptr);
      }
    }
    function initSherpaOnnxOfflineTtsVitsModelConfig(config, Module) {
      const modelLen = Module.lengthBytesUTF8(config.model || "") + 1;
      const lexiconLen = Module.lengthBytesUTF8(config.lexicon || "") + 1;
      const tokensLen = Module.lengthBytesUTF8(config.tokens || "") + 1;
      const dataDirLen = Module.lengthBytesUTF8(config.dataDir || "") + 1;
      const dictDir = "";
      const dictDirLen = Module.lengthBytesUTF8(dictDir) + 1;
      const n = modelLen + lexiconLen + tokensLen + dataDirLen + dictDirLen;
      const buffer = Module._malloc(n);
      const len = 8 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(config.model || "", buffer + offset, modelLen);
      offset += modelLen;
      Module.stringToUTF8(config.lexicon || "", buffer + offset, lexiconLen);
      offset += lexiconLen;
      Module.stringToUTF8(config.tokens || "", buffer + offset, tokensLen);
      offset += tokensLen;
      Module.stringToUTF8(config.dataDir || "", buffer + offset, dataDirLen);
      offset += dataDirLen;
      Module.stringToUTF8(dictDir, buffer + offset, dictDirLen);
      offset += dictDirLen;
      offset = 0;
      Module.setValue(ptr, buffer + offset, "i8*");
      offset += modelLen;
      Module.setValue(ptr + 4, buffer + offset, "i8*");
      offset += lexiconLen;
      Module.setValue(ptr + 8, buffer + offset, "i8*");
      offset += tokensLen;
      Module.setValue(ptr + 12, buffer + offset, "i8*");
      offset += dataDirLen;
      Module.setValue(ptr + 16, config.noiseScale || 0.667, "float");
      Module.setValue(ptr + 20, config.noiseScaleW || 0.8, "float");
      Module.setValue(ptr + 24, config.lengthScale || 1, "float");
      Module.setValue(ptr + 28, buffer + offset, "i8*");
      offset += dictDirLen;
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineTtsMatchaModelConfig(config, Module) {
      const acousticModelLen = Module.lengthBytesUTF8(config.acousticModel) + 1;
      const vocoderLen = Module.lengthBytesUTF8(config.vocoder) + 1;
      const lexiconLen = Module.lengthBytesUTF8(config.lexicon || "") + 1;
      const tokensLen = Module.lengthBytesUTF8(config.tokens || "") + 1;
      const dataDirLen = Module.lengthBytesUTF8(config.dataDir || "") + 1;
      const dictDir = "";
      const dictDirLen = Module.lengthBytesUTF8(dictDir) + 1;
      const n = acousticModelLen + vocoderLen + lexiconLen + tokensLen + dataDirLen + dictDirLen;
      const buffer = Module._malloc(n);
      const len = 8 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(
        config.acousticModel || "",
        buffer + offset,
        acousticModelLen
      );
      offset += acousticModelLen;
      Module.stringToUTF8(config.vocoder || "", buffer + offset, vocoderLen);
      offset += vocoderLen;
      Module.stringToUTF8(config.lexicon || "", buffer + offset, lexiconLen);
      offset += lexiconLen;
      Module.stringToUTF8(config.tokens || "", buffer + offset, tokensLen);
      offset += tokensLen;
      Module.stringToUTF8(config.dataDir || "", buffer + offset, dataDirLen);
      offset += dataDirLen;
      Module.stringToUTF8(dictDir, buffer + offset, dictDirLen);
      offset += dictDirLen;
      offset = 0;
      Module.setValue(ptr, buffer + offset, "i8*");
      offset += acousticModelLen;
      Module.setValue(ptr + 4, buffer + offset, "i8*");
      offset += vocoderLen;
      Module.setValue(ptr + 8, buffer + offset, "i8*");
      offset += lexiconLen;
      Module.setValue(ptr + 12, buffer + offset, "i8*");
      offset += tokensLen;
      Module.setValue(ptr + 16, buffer + offset, "i8*");
      offset += dataDirLen;
      Module.setValue(ptr + 20, config.noiseScale || 0.667, "float");
      Module.setValue(ptr + 24, config.lengthScale || 1, "float");
      Module.setValue(ptr + 28, buffer + offset, "i8*");
      offset += dictDirLen;
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineTtsKokoroModelConfig(config, Module) {
      const modelLen = Module.lengthBytesUTF8(config.model) + 1;
      const voicesLen = Module.lengthBytesUTF8(config.voices) + 1;
      const tokensLen = Module.lengthBytesUTF8(config.tokens || "") + 1;
      const dataDirLen = Module.lengthBytesUTF8(config.dataDir || "") + 1;
      const dictDir = "";
      const dictDirLen = Module.lengthBytesUTF8(dictDir) + 1;
      const lexiconLen = Module.lengthBytesUTF8(config.lexicon || "") + 1;
      const langLen = Module.lengthBytesUTF8(config.lang || "") + 1;
      const n = modelLen + voicesLen + tokensLen + dataDirLen + dictDirLen + lexiconLen + langLen;
      const buffer = Module._malloc(n);
      const len = 8 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(config.model || "", buffer + offset, modelLen);
      offset += modelLen;
      Module.stringToUTF8(config.voices || "", buffer + offset, voicesLen);
      offset += voicesLen;
      Module.stringToUTF8(config.tokens || "", buffer + offset, tokensLen);
      offset += tokensLen;
      Module.stringToUTF8(config.dataDir || "", buffer + offset, dataDirLen);
      offset += dataDirLen;
      Module.stringToUTF8(dictDir, buffer + offset, dictDirLen);
      offset += dictDirLen;
      Module.stringToUTF8(config.lexicon || "", buffer + offset, lexiconLen);
      offset += lexiconLen;
      Module.stringToUTF8(config.lang || "", buffer + offset, langLen);
      offset += langLen;
      offset = 0;
      Module.setValue(ptr, buffer + offset, "i8*");
      offset += modelLen;
      Module.setValue(ptr + 4, buffer + offset, "i8*");
      offset += voicesLen;
      Module.setValue(ptr + 8, buffer + offset, "i8*");
      offset += tokensLen;
      Module.setValue(ptr + 12, buffer + offset, "i8*");
      offset += dataDirLen;
      Module.setValue(ptr + 16, config.lengthScale || 1, "float");
      Module.setValue(ptr + 20, buffer + offset, "i8*");
      offset += dictDirLen;
      Module.setValue(ptr + 24, buffer + offset, "i8*");
      offset += lexiconLen;
      Module.setValue(ptr + 28, buffer + offset, "i8*");
      offset += langLen;
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineTtsKittenModelConfig(config, Module) {
      const modelLen = Module.lengthBytesUTF8(config.model) + 1;
      const voicesLen = Module.lengthBytesUTF8(config.voices) + 1;
      const tokensLen = Module.lengthBytesUTF8(config.tokens || "") + 1;
      const dataDirLen = Module.lengthBytesUTF8(config.dataDir || "") + 1;
      const n = modelLen + voicesLen + tokensLen + dataDirLen;
      const buffer = Module._malloc(n);
      const len = 5 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(config.model || "", buffer + offset, modelLen);
      offset += modelLen;
      Module.stringToUTF8(config.voices || "", buffer + offset, voicesLen);
      offset += voicesLen;
      Module.stringToUTF8(config.tokens || "", buffer + offset, tokensLen);
      offset += tokensLen;
      Module.stringToUTF8(config.dataDir || "", buffer + offset, dataDirLen);
      offset += dataDirLen;
      offset = 0;
      Module.setValue(ptr, buffer + offset, "i8*");
      offset += modelLen;
      Module.setValue(ptr + 4, buffer + offset, "i8*");
      offset += voicesLen;
      Module.setValue(ptr + 8, buffer + offset, "i8*");
      offset += tokensLen;
      Module.setValue(ptr + 12, buffer + offset, "i8*");
      offset += dataDirLen;
      Module.setValue(ptr + 16, config.lengthScale || 1, "float");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineTtsZipVoiceModelConfig(config, Module) {
      const tokensLen = Module.lengthBytesUTF8(config.tokens || "") + 1;
      const encoderLen = Module.lengthBytesUTF8(config.encoder || "") + 1;
      const decoderLen = Module.lengthBytesUTF8(config.decoder || "") + 1;
      const vocoderLen = Module.lengthBytesUTF8(config.vocoder || "") + 1;
      const dataDirLen = Module.lengthBytesUTF8(config.dataDir || "") + 1;
      const lexiconLen = Module.lengthBytesUTF8(config.lexicon || "") + 1;
      const n = tokensLen + encoderLen + decoderLen + vocoderLen + dataDirLen + lexiconLen;
      const buffer = Module._malloc(n);
      const len = 10 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(config.tokens || "", buffer + offset, tokensLen);
      offset += tokensLen;
      Module.stringToUTF8(config.encoder || "", buffer + offset, encoderLen);
      offset += encoderLen;
      Module.stringToUTF8(config.decoder || "", buffer + offset, decoderLen);
      offset += decoderLen;
      Module.stringToUTF8(config.vocoder || "", buffer + offset, vocoderLen);
      offset += vocoderLen;
      Module.stringToUTF8(config.dataDir || "", buffer + offset, dataDirLen);
      offset += dataDirLen;
      Module.stringToUTF8(config.lexicon || "", buffer + offset, lexiconLen);
      offset += lexiconLen;
      offset = 0;
      Module.setValue(ptr, buffer + offset, "i8*");
      offset += tokensLen;
      Module.setValue(ptr + 4, buffer + offset, "i8*");
      offset += encoderLen;
      Module.setValue(ptr + 8, buffer + offset, "i8*");
      offset += decoderLen;
      Module.setValue(ptr + 12, buffer + offset, "i8*");
      offset += vocoderLen;
      Module.setValue(ptr + 16, buffer + offset, "i8*");
      offset += dataDirLen;
      Module.setValue(ptr + 20, buffer + offset, "i8*");
      offset += lexiconLen;
      Module.setValue(ptr + 24, config.featScale || 0.1, "float");
      Module.setValue(ptr + 28, config.tShift || 0.5, "float");
      Module.setValue(ptr + 32, config.targetRMS || 0.1, "float");
      Module.setValue(ptr + 36, config.guidanceScale || 1, "float");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineTtsPocketModelConfig(config, Module) {
      const lmFlowLen = Module.lengthBytesUTF8(config.lmFlow || "") + 1;
      const lmMainLen = Module.lengthBytesUTF8(config.lmMain || "") + 1;
      const encoderLen = Module.lengthBytesUTF8(config.encoder || "") + 1;
      const decoderLen = Module.lengthBytesUTF8(config.decoder || "") + 1;
      const textConditionerLen = Module.lengthBytesUTF8(config.textConditioner || "") + 1;
      const vocabJsonLen = Module.lengthBytesUTF8(config.vocabJson || "") + 1;
      const tokenScoresJsonLen = Module.lengthBytesUTF8(config.tokenScoresJson || "") + 1;
      const n = lmFlowLen + lmMainLen + encoderLen + decoderLen + textConditionerLen + vocabJsonLen + tokenScoresJsonLen;
      const buffer = Module._malloc(n);
      const len = 8 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(config.lmFlow || "", buffer + offset, lmFlowLen);
      offset += lmFlowLen;
      Module.stringToUTF8(config.lmMain || "", buffer + offset, lmMainLen);
      offset += lmMainLen;
      Module.stringToUTF8(config.encoder || "", buffer + offset, encoderLen);
      offset += encoderLen;
      Module.stringToUTF8(config.decoder || "", buffer + offset, decoderLen);
      offset += decoderLen;
      Module.stringToUTF8(
        config.textConditioner || "",
        buffer + offset,
        textConditionerLen
      );
      offset += textConditionerLen;
      Module.stringToUTF8(config.vocabJson || "", buffer + offset, vocabJsonLen);
      offset += vocabJsonLen;
      Module.stringToUTF8(
        config.tokenScoresJson || "",
        buffer + offset,
        tokenScoresJsonLen
      );
      offset += tokenScoresJsonLen;
      offset = 0;
      Module.setValue(ptr + 0 * 4, buffer + offset, "i8*");
      offset += lmFlowLen;
      Module.setValue(ptr + 1 * 4, buffer + offset, "i8*");
      offset += lmMainLen;
      Module.setValue(ptr + 2 * 4, buffer + offset, "i8*");
      offset += encoderLen;
      Module.setValue(ptr + 3 * 4, buffer + offset, "i8*");
      offset += decoderLen;
      Module.setValue(ptr + 4 * 4, buffer + offset, "i8*");
      offset += textConditionerLen;
      Module.setValue(ptr + 5 * 4, buffer + offset, "i8*");
      offset += vocabJsonLen;
      Module.setValue(ptr + 6 * 4, buffer + offset, "i8*");
      offset += tokenScoresJsonLen;
      Module.setValue(
        ptr + 7 * 4,
        config.voiceEmbeddingCacheCapacity !== void 0 ? config.voiceEmbeddingCacheCapacity : 50,
        "i32"
      );
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineTtsSupertonicModelConfig(config, Module) {
      const durationPredictorLen = Module.lengthBytesUTF8(config.durationPredictor || "") + 1;
      const textEncoderLen = Module.lengthBytesUTF8(config.textEncoder || "") + 1;
      const vectorEstimatorLen = Module.lengthBytesUTF8(config.vectorEstimator || "") + 1;
      const vocoderLen = Module.lengthBytesUTF8(config.vocoder || "") + 1;
      const ttsJsonLen = Module.lengthBytesUTF8(config.ttsJson || "") + 1;
      const unicodeIndexerLen = Module.lengthBytesUTF8(config.unicodeIndexer || "") + 1;
      const voiceStyleLen = Module.lengthBytesUTF8(config.voiceStyle || "") + 1;
      const n = durationPredictorLen + textEncoderLen + vectorEstimatorLen + vocoderLen + ttsJsonLen + unicodeIndexerLen + voiceStyleLen;
      const buffer = Module._malloc(n);
      const len = 7 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(
        config.durationPredictor || "",
        buffer + offset,
        durationPredictorLen
      );
      offset += durationPredictorLen;
      Module.stringToUTF8(
        config.textEncoder || "",
        buffer + offset,
        textEncoderLen
      );
      offset += textEncoderLen;
      Module.stringToUTF8(
        config.vectorEstimator || "",
        buffer + offset,
        vectorEstimatorLen
      );
      offset += vectorEstimatorLen;
      Module.stringToUTF8(config.vocoder || "", buffer + offset, vocoderLen);
      offset += vocoderLen;
      Module.stringToUTF8(config.ttsJson || "", buffer + offset, ttsJsonLen);
      offset += ttsJsonLen;
      Module.stringToUTF8(
        config.unicodeIndexer || "",
        buffer + offset,
        unicodeIndexerLen
      );
      offset += unicodeIndexerLen;
      Module.stringToUTF8(config.voiceStyle || "", buffer + offset, voiceStyleLen);
      offset += voiceStyleLen;
      offset = 0;
      Module.setValue(ptr + 0 * 4, buffer + offset, "i8*");
      offset += durationPredictorLen;
      Module.setValue(ptr + 1 * 4, buffer + offset, "i8*");
      offset += textEncoderLen;
      Module.setValue(ptr + 2 * 4, buffer + offset, "i8*");
      offset += vectorEstimatorLen;
      Module.setValue(ptr + 3 * 4, buffer + offset, "i8*");
      offset += vocoderLen;
      Module.setValue(ptr + 4 * 4, buffer + offset, "i8*");
      offset += ttsJsonLen;
      Module.setValue(ptr + 5 * 4, buffer + offset, "i8*");
      offset += unicodeIndexerLen;
      Module.setValue(ptr + 6 * 4, buffer + offset, "i8*");
      offset += voiceStyleLen;
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineTtsModelConfig(config, Module) {
      if (!("offlineTtsVitsModelConfig" in config)) {
        config.offlineTtsVitsModelConfig = {
          model: "",
          lexicon: "",
          tokens: "",
          noiseScale: 0.667,
          noiseScaleW: 0.8,
          lengthScale: 1,
          dataDir: ""
        };
      }
      if (!("offlineTtsMatchaModelConfig" in config)) {
        config.offlineTtsMatchaModelConfig = {
          acousticModel: "",
          vocoder: "",
          lexicon: "",
          tokens: "",
          noiseScale: 0.667,
          lengthScale: 1,
          dataDir: ""
        };
      }
      if (!("offlineTtsKokoroModelConfig" in config)) {
        config.offlineTtsKokoroModelConfig = {
          model: "",
          voices: "",
          tokens: "",
          lengthScale: 1,
          dataDir: "",
          lexicon: "",
          lang: ""
        };
      }
      if (!("offlineTtsKittenModelConfig" in config)) {
        config.offlineTtsKittenModelConfig = {
          model: "",
          voices: "",
          tokens: "",
          lengthScale: 1
        };
      }
      if (!("offlineTtsZipVoiceModelConfig" in config)) {
        config.offlineTtsZipVoiceModelConfig = {
          tokens: "",
          encoder: "",
          decoder: "",
          vocoder: "",
          dataDir: "",
          lexicon: "",
          featScale: 0.1,
          tShift: 0.5,
          targetRMS: 0.1,
          guidanceScale: 1
        };
      }
      if (!("offlineTtsPocketModelConfig" in config)) {
        config.offlineTtsPocketModelConfig = {
          lmFlow: "",
          lmMain: "",
          encoder: "",
          decoder: "",
          textConditioner: "",
          vocabJson: "",
          tokenScoresJson: "",
          voiceEmbeddingCacheCapacity: 50
        };
      }
      if (!("offlineTtsSupertonicModelConfig" in config)) {
        config.offlineTtsSupertonicModelConfig = {
          durationPredictor: "",
          textEncoder: "",
          vectorEstimator: "",
          vocoder: "",
          ttsJson: "",
          unicodeIndexer: "",
          voiceStyle: ""
        };
      }
      const vitsModelConfig = initSherpaOnnxOfflineTtsVitsModelConfig(
        config.offlineTtsVitsModelConfig,
        Module
      );
      const matchaModelConfig = initSherpaOnnxOfflineTtsMatchaModelConfig(
        config.offlineTtsMatchaModelConfig,
        Module
      );
      const kokoroModelConfig = initSherpaOnnxOfflineTtsKokoroModelConfig(
        config.offlineTtsKokoroModelConfig,
        Module
      );
      const kittenModelConfig = initSherpaOnnxOfflineTtsKittenModelConfig(
        config.offlineTtsKittenModelConfig,
        Module
      );
      const zipVoiceModelConfig = initSherpaOnnxOfflineTtsZipVoiceModelConfig(
        config.offlineTtsZipVoiceModelConfig,
        Module
      );
      const pocketModelConfig = initSherpaOnnxOfflineTtsPocketModelConfig(
        config.offlineTtsPocketModelConfig,
        Module
      );
      const supertonicModelConfig = initSherpaOnnxOfflineTtsSupertonicModelConfig(
        config.offlineTtsSupertonicModelConfig,
        Module
      );
      const len = vitsModelConfig.len + matchaModelConfig.len + kokoroModelConfig.len + kittenModelConfig.len + zipVoiceModelConfig.len + pocketModelConfig.len + supertonicModelConfig.len + 3 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module._CopyHeap(vitsModelConfig.ptr, vitsModelConfig.len, ptr + offset);
      offset += vitsModelConfig.len;
      Module.setValue(ptr + offset, config.numThreads || 1, "i32");
      offset += 4;
      Module.setValue(ptr + offset, config.debug || 0, "i32");
      offset += 4;
      const providerLen = Module.lengthBytesUTF8(config.provider || "cpu") + 1;
      const buffer = Module._malloc(providerLen);
      Module.stringToUTF8(config.provider || "cpu", buffer, providerLen);
      Module.setValue(ptr + offset, buffer, "i8*");
      offset += 4;
      Module._CopyHeap(matchaModelConfig.ptr, matchaModelConfig.len, ptr + offset);
      offset += matchaModelConfig.len;
      Module._CopyHeap(kokoroModelConfig.ptr, kokoroModelConfig.len, ptr + offset);
      offset += kokoroModelConfig.len;
      Module._CopyHeap(kittenModelConfig.ptr, kittenModelConfig.len, ptr + offset);
      offset += kittenModelConfig.len;
      Module._CopyHeap(
        zipVoiceModelConfig.ptr,
        zipVoiceModelConfig.len,
        ptr + offset
      );
      offset += zipVoiceModelConfig.len;
      Module._CopyHeap(pocketModelConfig.ptr, pocketModelConfig.len, ptr + offset);
      offset += pocketModelConfig.len;
      Module._CopyHeap(
        supertonicModelConfig.ptr,
        supertonicModelConfig.len,
        ptr + offset
      );
      offset += supertonicModelConfig.len;
      return {
        buffer,
        ptr,
        len,
        config: vitsModelConfig,
        matcha: matchaModelConfig,
        kokoro: kokoroModelConfig,
        kitten: kittenModelConfig,
        zipvoice: zipVoiceModelConfig,
        pocket: pocketModelConfig,
        supertonic: supertonicModelConfig
      };
    }
    function initSherpaOnnxOfflineTtsConfig(config, Module) {
      const modelConfig = initSherpaOnnxOfflineTtsModelConfig(config.offlineTtsModelConfig, Module);
      const len = modelConfig.len + 4 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module._CopyHeap(modelConfig.ptr, modelConfig.len, ptr + offset);
      offset += modelConfig.len;
      const ruleFstsLen = Module.lengthBytesUTF8(config.ruleFsts || "") + 1;
      const ruleFarsLen = Module.lengthBytesUTF8(config.ruleFars || "") + 1;
      const buffer = Module._malloc(ruleFstsLen + ruleFarsLen);
      Module.stringToUTF8(config.ruleFsts || "", buffer, ruleFstsLen);
      Module.stringToUTF8(config.ruleFars || "", buffer + ruleFstsLen, ruleFarsLen);
      Module.setValue(ptr + offset, buffer, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.maxNumSentences || 1, "i32");
      offset += 4;
      Module.setValue(ptr + offset, buffer + ruleFstsLen, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.silenceScale || 0.2, "float");
      offset += 4;
      return {
        buffer,
        ptr,
        len,
        config: modelConfig
      };
    }
    function initSherpaOnnxGenerationConfig(config, Module) {
      const len = 9 * 4;
      const ptr = Module._malloc(len);
      Module.setValue(ptr + 0 * 4, config.silenceScale || 0.2, "float");
      Module.setValue(ptr + 1 * 4, config.speed || 1, "float");
      Module.setValue(ptr + 2 * 4, config.sid || 0, "i32");
      let referenceAudioPtr = 0;
      if (config.referenceAudio && config.referenceAudio.length > 0) {
        referenceAudioPtr = Module._malloc(config.referenceAudio.length * 4);
        Module.HEAPF32.set(config.referenceAudio, referenceAudioPtr / 4);
      }
      Module.setValue(ptr + 3 * 4, referenceAudioPtr, "i8*");
      Module.setValue(
        ptr + 4 * 4,
        config.referenceAudio ? config.referenceAudio.length : 0,
        "i32"
      );
      Module.setValue(ptr + 5 * 4, config.referenceSampleRate || 0, "i32");
      let referenceTextPtr = 0;
      if (config.referenceText) {
        const textLen = Module.lengthBytesUTF8(config.referenceText) + 1;
        referenceTextPtr = Module._malloc(textLen);
        Module.stringToUTF8(config.referenceText, referenceTextPtr, textLen);
      }
      Module.setValue(ptr + 6 * 4, referenceTextPtr, "i8*");
      Module.setValue(ptr + 7 * 4, config.numSteps || 5, "i32");
      let extraPtr = 0;
      let extraStr = null;
      if (config.extra) {
        if (typeof config.extra === "object") {
          extraStr = JSON.stringify(config.extra);
        } else if (typeof config.extra === "string") {
          extraStr = config.extra;
        }
      }
      if (extraStr !== null) {
        const extraLen = Module.lengthBytesUTF8(extraStr) + 1;
        extraPtr = Module._malloc(extraLen);
        Module.stringToUTF8(extraStr, extraPtr, extraLen);
      }
      Module.setValue(ptr + 8 * 4, extraPtr, "i8*");
      return {
        ptr,
        referenceAudioPtr,
        referenceTextPtr,
        extraPtr
      };
    }
    function freeSherpaOnnxGenerationConfig(cfg, Module) {
      if (!cfg) return;
      if (cfg.referenceAudioPtr) Module._free(cfg.referenceAudioPtr);
      if (cfg.referenceTextPtr) Module._free(cfg.referenceTextPtr);
      if (cfg.extraPtr) Module._free(cfg.extraPtr);
      if (cfg.ptr) Module._free(cfg.ptr);
    }
    var OfflineTts = class {
      constructor(configObj, Module) {
        const config = initSherpaOnnxOfflineTtsConfig(configObj, Module);
        const handle = Module._SherpaOnnxCreateOfflineTts(config.ptr);
        freeConfig(config, Module);
        this.handle = handle;
        this.sampleRate = Module._SherpaOnnxOfflineTtsSampleRate(this.handle);
        this.numSpeakers = Module._SherpaOnnxOfflineTtsNumSpeakers(this.handle);
        this.Module = Module;
      }
      free() {
        if (!this.handle) return;
        this.Module._SherpaOnnxDestroyOfflineTts(this.handle);
        this.handle = 0;
      }
      // {
      //   text: "hello",
      //   sid: 1,
      //   speed: 1.0
      // }
      generate(config) {
        if (!this.handle) {
          throw new Error("OfflineTts has been freed");
        }
        if (!config || !config.text) {
          throw new Error("config.text is required");
        }
        const textLen = this.Module.lengthBytesUTF8(config.text) + 1;
        const textPtr = this.Module._malloc(textLen);
        this.Module.stringToUTF8(config.text, textPtr, textLen);
        const genConfig = {
          sid: config.sid ?? 0,
          speed: config.speed ?? 1
        };
        const cfgWasm = initSherpaOnnxGenerationConfig(genConfig, this.Module);
        const h = this.Module._SherpaOnnxOfflineTtsGenerateWithConfig(
          this.handle,
          textPtr,
          cfgWasm.ptr,
          0,
          0
        );
        freeSherpaOnnxGenerationConfig(cfgWasm, this.Module);
        this.Module._free(textPtr);
        if (!h) {
          throw new Error("TTS generation failed");
        }
        const base = h / 4;
        const samplesPtr = this.Module.HEAPU32[base];
        const numSamples = this.Module.HEAP32[base + 1];
        const sampleRate = this.Module.HEAP32[base + 2];
        const heapSamples = this.Module.HEAPF32.subarray(
          samplesPtr / 4,
          samplesPtr / 4 + numSamples
        );
        const samples = new Float32Array(heapSamples);
        this.Module._SherpaOnnxDestroyOfflineTtsGeneratedAudio(h);
        return { samples, sampleRate };
      }
      generateWithConfig(text, genConfig) {
        if (!this.handle) {
          throw new Error("OfflineTts has been freed");
        }
        const cfgWasm = initSherpaOnnxGenerationConfig(genConfig, this.Module);
        const textLen = this.Module.lengthBytesUTF8(text) + 1;
        const textPtr = this.Module._malloc(textLen);
        this.Module.stringToUTF8(text, textPtr, textLen);
        let callbackPtr = 0;
        if (genConfig.callback) {
          callbackPtr = this.Module.addFunction((samplesPtr2, n, progress, arg) => {
            const heapSamples2 = this.Module.HEAPF32.subarray(samplesPtr2 / 4, samplesPtr2 / 4 + n);
            const samples2 = new Float32Array(heapSamples2);
            return genConfig.callback(samples2, n, progress, arg);
          }, "iiifi");
        }
        let audioPtr = 0;
        try {
          audioPtr = this.Module._SherpaOnnxOfflineTtsGenerateWithConfig(
            this.handle,
            textPtr,
            cfgWasm.ptr,
            callbackPtr,
            0
          );
        } finally {
          this.Module._free(textPtr);
          freeSherpaOnnxGenerationConfig(cfgWasm, this.Module);
          if (callbackPtr) {
            this.Module.removeFunction(callbackPtr);
          }
        }
        if (!audioPtr) {
          throw new Error("Failed to generate audio");
        }
        const base = audioPtr / 4;
        const samplesPtr = this.Module.HEAPU32[base];
        const numSamples = this.Module.HEAP32[base + 1];
        const sampleRate = this.Module.HEAP32[base + 2];
        const heapSamples = this.Module.HEAPF32.subarray(
          samplesPtr / 4,
          samplesPtr / 4 + numSamples
        );
        const samples = new Float32Array(heapSamples);
        this.Module._SherpaOnnxDestroyOfflineTtsGeneratedAudio(audioPtr);
        return { samples, sampleRate };
      }
      save(filename, audio) {
        const samples = audio.samples;
        const sampleRate = audio.sampleRate;
        const ptr = this.Module._malloc(samples.length * 4);
        this.Module.HEAPF32.set(samples, ptr / 4);
        const filenameLen = this.Module.lengthBytesUTF8(filename) + 1;
        const buffer = this.Module._malloc(filenameLen);
        this.Module.stringToUTF8(filename, buffer, filenameLen);
        this.Module._SherpaOnnxWriteWave(ptr, samples.length, sampleRate, buffer);
        this.Module._free(buffer);
        this.Module._free(ptr);
      }
    };
    var modelType = 0;
    function getDefaultOfflineTtsModelType() {
      return modelType;
    }
    function createOfflineTts(Module, myConfig) {
      const vits = {
        model: "",
        lexicon: "",
        tokens: "",
        dataDir: "",
        noiseScale: 0.667,
        noiseScaleW: 0.8,
        lengthScale: 1
      };
      const matcha = {
        acousticModel: "",
        vocoder: "",
        lexicon: "",
        tokens: "",
        dataDir: "",
        noiseScale: 0.667,
        lengthScale: 1
      };
      const offlineTtsKokoroModelConfig = {
        model: "",
        voices: "",
        tokens: "",
        dataDir: "",
        lengthScale: 1,
        lexicon: "",
        lang: ""
      };
      const offlineTtsKittenModelConfig = {
        model: "",
        voices: "",
        tokens: "",
        dataDir: "",
        lengthScale: 1
      };
      const offlineTtsZipVoiceModelConfig = {
        tokens: "",
        encoder: "",
        decoder: "",
        vocoder: "",
        dataDir: "",
        lexicon: "",
        featScale: 0.1,
        tShift: 0.5,
        targetRMS: 0.1,
        guidanceScale: 1
      };
      const offlineTtsPocketModelConfig = {
        lmFlow: "",
        lmMain: "",
        encoder: "",
        decoder: "",
        textConditioner: "",
        vocabJson: "",
        tokenScoresJson: "",
        voiceEmbeddingCacheCapacity: 50
      };
      let ruleFsts = "";
      switch (modelType) {
        case 0:
          vits.model = "./model.onnx";
          vits.tokens = "./tokens.txt";
          vits.dataDir = "./espeak-ng-data";
          break;
        case 1:
          matcha.acousticModel = "./model-steps-3.onnx";
          matcha.vocoder = "./vocos-16khz-univ.onnx";
          matcha.lexicon = "./lexicon.txt";
          matcha.tokens = "./tokens.txt";
          matcha.dataDir = "./espeak-ng-data";
          ruleFsts = "./phone-zh.fst,./date-zh.fst,./number-zh.fst";
          break;
        case 2:
          matcha.acousticModel = "./model-steps-3.onnx";
          matcha.vocoder = "./vocos-22khz-univ.onnx";
          matcha.lexicon = "./lexicon.txt";
          matcha.tokens = "./tokens.txt";
          ruleFsts = "./phone.fst,./date.fst,./number.fst";
          break;
        case 3:
          matcha.acousticModel = "./model-steps-3.onnx";
          matcha.vocoder = "./vocos-22khz-univ.onnx";
          matcha.tokens = "./tokens.txt";
          matcha.dataDir = "./espeak-ng-data";
          break;
        case 4:
          offlineTtsZipVoiceModelConfig.tokens = "./tokens.txt";
          offlineTtsZipVoiceModelConfig.encoder = "./encoder.int8.onnx";
          offlineTtsZipVoiceModelConfig.decoder = "./decoder.int8.onnx";
          offlineTtsZipVoiceModelConfig.vocoder = "./vocos_24khz.onnx";
          offlineTtsZipVoiceModelConfig.dataDir = "./espeak-ng-data";
          offlineTtsZipVoiceModelConfig.lexicon = "./lexicon.txt";
          break;
        case 5:
          offlineTtsPocketModelConfig.lmFlow = "./lm_flow.int8.onnx";
          offlineTtsPocketModelConfig.lmMain = "./lm_main.int8.onnx";
          offlineTtsPocketModelConfig.encoder = "./encoder.onnx";
          offlineTtsPocketModelConfig.decoder = "./decoder.int8.onnx";
          offlineTtsPocketModelConfig.textConditioner = "./text_conditioner.onnx";
          offlineTtsPocketModelConfig.vocabJson = "./vocab.json";
          offlineTtsPocketModelConfig.tokenScoresJson = "./token_scores.json";
          break;
      }
      const offlineTtsModelConfig = {
        offlineTtsVitsModelConfig: vits,
        offlineTtsMatchaModelConfig: matcha,
        offlineTtsKokoroModelConfig,
        offlineTtsKittenModelConfig,
        offlineTtsZipVoiceModelConfig,
        offlineTtsPocketModelConfig,
        numThreads: 1,
        debug: 1,
        provider: "cpu"
      };
      let offlineTtsConfig = {
        offlineTtsModelConfig,
        ruleFsts,
        ruleFars: "",
        maxNumSentences: 1
      };
      if (myConfig) {
        offlineTtsConfig = myConfig;
      }
      return new OfflineTts(offlineTtsConfig, Module);
    }
    if (typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string") {
      module2.exports = {
        createOfflineTts,
        getDefaultOfflineTtsModelType
      };
    }
  }
});

// node_modules/sherpa-onnx/sherpa-onnx-kws.js
var require_sherpa_onnx_kws = __commonJS({
  "node_modules/sherpa-onnx/sherpa-onnx-kws.js"(exports2, module2) {
    function freeConfig(config, Module) {
      if ("buffer" in config) {
        Module._free(config.buffer);
      }
      if ("transducer" in config) {
        freeConfig(config.transducer, Module);
      }
      if ("featConfig" in config) {
        freeConfig(config.featConfig, Module);
      }
      if ("modelConfig" in config) {
        freeConfig(config.modelConfig, Module);
      }
      if ("keywordsBuffer" in config) {
        Module._free(config.keywordsBuffer);
      }
      Module._free(config.ptr);
    }
    function initSherpaOnnxOnlineTransducerModelConfig(config, Module) {
      const encoderLen = Module.lengthBytesUTF8(config.encoder) + 1;
      const decoderLen = Module.lengthBytesUTF8(config.decoder) + 1;
      const joinerLen = Module.lengthBytesUTF8(config.joiner) + 1;
      const n = encoderLen + decoderLen + joinerLen;
      const buffer = Module._malloc(n);
      const len = 3 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(config.encoder, buffer + offset, encoderLen);
      offset += encoderLen;
      Module.stringToUTF8(config.decoder, buffer + offset, decoderLen);
      offset += decoderLen;
      Module.stringToUTF8(config.joiner, buffer + offset, joinerLen);
      offset = 0;
      Module.setValue(ptr, buffer + offset, "i8*");
      offset += encoderLen;
      Module.setValue(ptr + 4, buffer + offset, "i8*");
      offset += decoderLen;
      Module.setValue(ptr + 8, buffer + offset, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initModelConfig(config, Module) {
      if (!("tokensBuf" in config)) {
        config.tokensBuf = "";
      }
      if (!("tokensBufSize" in config)) {
        config.tokensBufSize = 0;
      }
      const transducer = initSherpaOnnxOnlineTransducerModelConfig(config.transducer, Module);
      const paraformer_len = 2 * 4;
      const zipfomer2_ctc_len = 1 * 4;
      const nemo_ctc_len = 1 * 4;
      const t_one_ctc_len = 1 * 4;
      const len = transducer.len + paraformer_len + zipfomer2_ctc_len + 9 * 4 + nemo_ctc_len + t_one_ctc_len;
      const ptr = Module._malloc(len);
      Module.HEAPU8.fill(0, ptr, ptr + len);
      let offset = 0;
      Module._CopyHeap(transducer.ptr, transducer.len, ptr + offset);
      const tokensLen = Module.lengthBytesUTF8(config.tokens) + 1;
      const providerLen = Module.lengthBytesUTF8(config.provider || "cpu") + 1;
      const modelTypeLen = Module.lengthBytesUTF8(config.modelType || "") + 1;
      const modelingUnitLen = Module.lengthBytesUTF8(config.modelingUnit || "") + 1;
      const bpeVocabLen = Module.lengthBytesUTF8(config.bpeVocab || "") + 1;
      const tokensBufLen = Module.lengthBytesUTF8(config.tokensBuf || "") + 1;
      const bufferLen = tokensLen + providerLen + modelTypeLen + modelingUnitLen + bpeVocabLen + tokensBufLen;
      const buffer = Module._malloc(bufferLen);
      offset = 0;
      Module.stringToUTF8(config.tokens, buffer, tokensLen);
      offset += tokensLen;
      Module.stringToUTF8(config.provider || "cpu", buffer + offset, providerLen);
      offset += providerLen;
      Module.stringToUTF8(config.modelType || "", buffer + offset, modelTypeLen);
      offset += modelTypeLen;
      Module.stringToUTF8(
        config.modelingUnit || "",
        buffer + offset,
        modelingUnitLen
      );
      offset += modelingUnitLen;
      Module.stringToUTF8(config.bpeVocab || "", buffer + offset, bpeVocabLen);
      offset += bpeVocabLen;
      Module.stringToUTF8(config.tokensBuf || "", buffer + offset, tokensBufLen);
      offset += tokensBufLen;
      offset = transducer.len + paraformer_len + zipfomer2_ctc_len;
      Module.setValue(ptr + offset, buffer, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.numThreads || 1, "i32");
      offset += 4;
      Module.setValue(ptr + offset, buffer + tokensLen, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.debug, "i32");
      offset += 4;
      Module.setValue(
        ptr + offset,
        buffer + tokensLen + providerLen,
        "i8*"
      );
      offset += 4;
      Module.setValue(
        ptr + offset,
        buffer + tokensLen + providerLen + modelTypeLen,
        "i8*"
      );
      offset += 4;
      Module.setValue(
        ptr + offset,
        buffer + tokensLen + providerLen + modelTypeLen + modelingUnitLen,
        "i8*"
      );
      offset += 4;
      Module.setValue(
        ptr + offset,
        buffer + tokensLen + providerLen + modelTypeLen + modelingUnitLen + bpeVocabLen,
        "i8*"
      );
      offset += 4;
      Module.setValue(ptr + offset, config.tokensBufSize || 0, "i32");
      offset += 4;
      return { buffer, ptr, len, transducer };
    }
    function initFeatureExtractorConfig(config, Module) {
      let ptr = Module._malloc(4 * 2);
      Module.setValue(ptr, config.samplingRate || 16e3, "i32");
      Module.setValue(ptr + 4, config.featureDim || 80, "i32");
      return {
        ptr,
        len: 8
      };
    }
    function initKwsConfig(config, Module) {
      if (!("featConfig" in config)) {
        config.featConfig = {
          sampleRate: 16e3,
          featureDim: 80
        };
      }
      if (!("keywordsBuf" in config)) {
        config.keywordsBuf = "";
      }
      if (!("keywordsBufSize" in config)) {
        config.keywordsBufSize = 0;
      }
      let featConfig = initFeatureExtractorConfig(config.featConfig, Module);
      let modelConfig = initModelConfig(config.modelConfig, Module);
      let numBytes = featConfig.len + modelConfig.len + 4 * 7;
      let ptr = Module._malloc(numBytes);
      let offset = 0;
      Module._CopyHeap(featConfig.ptr, featConfig.len, ptr + offset);
      offset += featConfig.len;
      Module._CopyHeap(modelConfig.ptr, modelConfig.len, ptr + offset);
      offset += modelConfig.len;
      Module.setValue(ptr + offset, config.maxActivePaths || 4, "i32");
      offset += 4;
      Module.setValue(ptr + offset, config.numTrailingBlanks || 1, "i32");
      offset += 4;
      Module.setValue(ptr + offset, config.keywordsScore || 1, "float");
      offset += 4;
      Module.setValue(ptr + offset, config.keywordsThreshold || 0.25, "float");
      offset += 4;
      let keywordsLen = Module.lengthBytesUTF8(config.keywords) + 1;
      let keywordsBufLen = Module.lengthBytesUTF8(config.keywordsBuf) + 1;
      let keywordsBuffer = Module._malloc(keywordsLen + keywordsBufLen);
      Module.stringToUTF8(config.keywords, keywordsBuffer, keywordsLen);
      Module.stringToUTF8(
        config.keywordsBuf,
        keywordsBuffer + keywordsLen,
        keywordsBufLen
      );
      Module.setValue(ptr + offset, keywordsBuffer, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, keywordsBuffer + keywordsLen, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.keywordsBufSize, "i32");
      offset += 4;
      return {
        ptr,
        len: numBytes,
        featConfig,
        modelConfig,
        keywordsBuffer
      };
    }
    var Stream = class {
      constructor(handle, Module) {
        this.handle = handle;
        this.pointer = null;
        this.n = 0;
        this.Module = Module;
      }
      free() {
        if (this.handle) {
          this.Module._SherpaOnnxDestroyOnlineStream(this.handle);
          this.handle = null;
          this.Module._free(this.pointer);
          this.pointer = null;
          this.n = 0;
        }
      }
      /**
       * @param sampleRate {Number}
       * @param samples {Float32Array} Containing samples in the range [-1, 1]
       */
      acceptWaveform(sampleRate, samples) {
        if (this.n < samples.length) {
          this.Module._free(this.pointer);
          this.pointer = this.Module._malloc(samples.length * samples.BYTES_PER_ELEMENT);
          this.n = samples.length;
        }
        this.Module.HEAPF32.set(samples, this.pointer / samples.BYTES_PER_ELEMENT);
        this.Module._SherpaOnnxOnlineStreamAcceptWaveform(
          this.handle,
          sampleRate,
          this.pointer,
          samples.length
        );
      }
      inputFinished() {
        this.Module._SherpaOnnxOnlineStreamInputFinished(this.handle);
      }
    };
    var Kws = class {
      constructor(configObj, Module) {
        this.config = configObj;
        let config = initKwsConfig(configObj, Module);
        let handle = Module._SherpaOnnxCreateKeywordSpotter(config.ptr);
        freeConfig(config, Module);
        this.handle = handle;
        this.Module = Module;
      }
      free() {
        this.Module._SherpaOnnxDestroyKeywordSpotter(this.handle);
        this.handle = 0;
      }
      createStream() {
        let handle = this.Module._SherpaOnnxCreateKeywordStream(this.handle);
        return new Stream(handle, this.Module);
      }
      isReady(stream) {
        return this.Module._SherpaOnnxIsKeywordStreamReady(
          this.handle,
          stream.handle
        ) == 1;
      }
      decode(stream) {
        this.Module._SherpaOnnxDecodeKeywordStream(this.handle, stream.handle);
      }
      reset(stream) {
        this.Module._SherpaOnnxResetKeywordStream(this.handle, stream.handle);
      }
      getResult(stream) {
        let r = this.Module._SherpaOnnxGetKeywordResult(this.handle, stream.handle);
        let jsonPtr = this.Module.getValue(r + 24, "i8*");
        let json = this.Module.UTF8ToString(jsonPtr);
        this.Module._SherpaOnnxDestroyKeywordResult(r);
        return JSON.parse(json);
      }
    };
    function createKws(Module, myConfig) {
      let transducerConfig = {
        encoder: "./encoder-epoch-12-avg-2-chunk-16-left-64.onnx",
        decoder: "./decoder-epoch-12-avg-2-chunk-16-left-64.onnx",
        joiner: "./joiner-epoch-12-avg-2-chunk-16-left-64.onnx"
      };
      let modelConfig = {
        transducer: transducerConfig,
        tokens: "./tokens.txt",
        provider: "cpu",
        modelType: "",
        numThreads: 1,
        debug: 1,
        modelingUnit: "cjkchar",
        bpeVocab: ""
      };
      let featConfig = {
        samplingRate: 16e3,
        featureDim: 80
      };
      let configObj = {
        featConfig,
        modelConfig,
        maxActivePaths: 4,
        numTrailingBlanks: 1,
        keywordsScore: 1,
        keywordsThreshold: 0.25,
        keywords: "x i\u01CEo \xE0i t \xF3ng x u\xE9 @\u5C0F\u7231\u540C\u5B66\nj \u016Bn g \u0113 n i\xFA b \u012B @\u519B\u54E5\u725B\u903C"
      };
      if (myConfig) {
        configObj = myConfig;
      }
      return new Kws(configObj, Module);
    }
    if (typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string") {
      module2.exports = {
        createKws
      };
    }
  }
});

// node_modules/sherpa-onnx/sherpa-onnx-wave.js
var require_sherpa_onnx_wave = __commonJS({
  "node_modules/sherpa-onnx/sherpa-onnx-wave.js"(exports2, module2) {
    function readWave(filename, Module) {
      const filenameLen = Module.lengthBytesUTF8(filename) + 1;
      const pFilename = Module._malloc(filenameLen);
      Module.stringToUTF8(filename, pFilename, filenameLen);
      const w = Module._SherpaOnnxReadWave(pFilename);
      Module._free(pFilename);
      const samplesPtr = Module.HEAP32[w / 4] / 4;
      const sampleRate = Module.HEAP32[w / 4 + 1];
      const numSamples = Module.HEAP32[w / 4 + 2];
      const samples = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        samples[i] = Module.HEAPF32[samplesPtr + i];
      }
      Module._SherpaOnnxFreeWave(w);
      return { samples, sampleRate };
    }
    function readWaveFromBinaryData(uint8Array, Module) {
      const numBytes = uint8Array.length * uint8Array.BYTES_PER_ELEMENT;
      const pointer = Module._malloc(numBytes);
      const dataOnHeap = new Uint8Array(Module.HEAPU8.buffer, pointer, numBytes);
      dataOnHeap.set(uint8Array);
      const w = Module._SherpaOnnxReadWaveFromBinaryData(dataOnHeap.byteOffset, numBytes);
      if (w == 0) {
        console.log("Failed to read wave from binary data");
        return null;
      }
      Module._free(pointer);
      const samplesPtr = Module.HEAP32[w / 4] / 4;
      const sampleRate = Module.HEAP32[w / 4 + 1];
      const numSamples = Module.HEAP32[w / 4 + 2];
      const samples = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        samples[i] = Module.HEAPF32[samplesPtr + i];
      }
      Module._SherpaOnnxFreeWave(w);
      return { samples, sampleRate };
    }
    function writeWave(filename, data, Module) {
      const pSamples = Module._malloc(data.samples.length * data.samples.BYTES_PER_ELEMENT);
      Module.HEAPF32.set(data.samples, pSamples / data.samples.BYTES_PER_ELEMENT);
      const filenameLen = Module.lengthBytesUTF8(filename) + 1;
      const pFilename = Module._malloc(filenameLen);
      Module.stringToUTF8(filename, pFilename, filenameLen);
      Module._SherpaOnnxWriteWave(
        pSamples,
        data.samples.length,
        data.sampleRate,
        pFilename
      );
      Module._free(pFilename);
      Module._free(pSamples);
    }
    if (typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string") {
      module2.exports = {
        readWave,
        writeWave,
        readWaveFromBinaryData
      };
    }
  }
});

// node_modules/sherpa-onnx/sherpa-onnx-vad.js
var require_sherpa_onnx_vad = __commonJS({
  "node_modules/sherpa-onnx/sherpa-onnx-vad.js"(exports2, module2) {
    function freeConfig(config, Module) {
      if ("buffer" in config) {
        Module._free(config.buffer);
      }
      if ("sileroVad" in config) {
        freeConfig(config.sileroVad, Module);
      }
      if ("tenVad" in config) {
        freeConfig(config.tenVad, Module);
      }
      Module._free(config.ptr);
    }
    function initSherpaOnnxSileroVadModelConfig(config, Module) {
      const modelLen = Module.lengthBytesUTF8(config.model || "") + 1;
      const n = modelLen;
      const buffer = Module._malloc(n);
      const len = 6 * 4;
      const ptr = Module._malloc(len);
      Module.stringToUTF8(config.model || "", buffer, modelLen);
      let offset = 0;
      Module.setValue(ptr, buffer, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.threshold || 0.5, "float");
      offset += 4;
      Module.setValue(ptr + offset, config.minSilenceDuration || 0.5, "float");
      offset += 4;
      Module.setValue(ptr + offset, config.minSpeechDuration || 0.25, "float");
      offset += 4;
      Module.setValue(ptr + offset, config.windowSize || 512, "i32");
      offset += 4;
      Module.setValue(ptr + offset, config.maxSpeechDuration || 20, "float");
      offset += 4;
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxTenVadModelConfig(config, Module) {
      const modelLen = Module.lengthBytesUTF8(config.model || "") + 1;
      const n = modelLen;
      const buffer = Module._malloc(n);
      const len = 6 * 4;
      const ptr = Module._malloc(len);
      Module.stringToUTF8(config.model || "", buffer, modelLen);
      let offset = 0;
      Module.setValue(ptr, buffer, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.threshold || 0.5, "float");
      offset += 4;
      Module.setValue(ptr + offset, config.minSilenceDuration || 0.5, "float");
      offset += 4;
      Module.setValue(ptr + offset, config.minSpeechDuration || 0.25, "float");
      offset += 4;
      Module.setValue(ptr + offset, config.windowSize || 256, "i32");
      offset += 4;
      Module.setValue(ptr + offset, config.maxSpeechDuration || 20, "float");
      offset += 4;
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxVadModelConfig(config, Module) {
      if (!("sileroVad" in config)) {
        config.sileroVad = {
          model: "",
          threshold: 0.5,
          minSilenceDuration: 0.5,
          minSpeechDuration: 0.25,
          windowSize: 512,
          maxSpeechDuration: 20
        };
      }
      if (!("tenVad" in config)) {
        config.tenVad = {
          model: "",
          threshold: 0.5,
          minSilenceDuration: 0.5,
          minSpeechDuration: 0.25,
          windowSize: 256,
          maxSpeechDuration: 20
        };
      }
      const sileroVad = initSherpaOnnxSileroVadModelConfig(config.sileroVad, Module);
      const tenVad = initSherpaOnnxTenVadModelConfig(config.tenVad, Module);
      const len = sileroVad.len + 4 * 4 + tenVad.len;
      const ptr = Module._malloc(len);
      const providerLen = Module.lengthBytesUTF8(config.provider || "cpu") + 1;
      const buffer = Module._malloc(providerLen);
      Module.stringToUTF8(config.provider || "cpu", buffer, providerLen);
      let offset = 0;
      Module._CopyHeap(sileroVad.ptr, sileroVad.len, ptr + offset);
      offset += sileroVad.len;
      Module.setValue(ptr + offset, config.sampleRate || 16e3, "i32");
      offset += 4;
      Module.setValue(ptr + offset, config.numThreads || 1, "i32");
      offset += 4;
      Module.setValue(ptr + offset, buffer, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.debug || 0, "i32");
      offset += 4;
      Module._CopyHeap(tenVad.ptr, tenVad.len, ptr + offset);
      offset += tenVad.len;
      return {
        buffer,
        ptr,
        len,
        sileroVad,
        tenVad
      };
    }
    function createVad(Module, myConfig) {
      const sileroVad = {
        model: "./silero_vad.onnx",
        threshold: 0.5,
        minSilenceDuration: 0.5,
        minSpeechDuration: 0.25,
        maxSpeechDuration: 20,
        windowSize: 512
      };
      const tenVad = {
        model: "",
        threshold: 0.5,
        minSilenceDuration: 0.5,
        minSpeechDuration: 0.25,
        maxSpeechDuration: 20,
        windowSize: 256
      };
      let config = {
        sileroVad,
        tenVad,
        sampleRate: 16e3,
        numThreads: 1,
        provider: "cpu",
        debug: 1,
        bufferSizeInSeconds: 30
      };
      if (myConfig) {
        config = myConfig;
      }
      return new Vad(config, Module);
    }
    var CircularBuffer = class {
      constructor(capacity, Module) {
        this.handle = Module._SherpaOnnxCreateCircularBuffer(capacity);
        this.Module = Module;
      }
      free() {
        this.Module._SherpaOnnxDestroyCircularBuffer(this.handle);
        this.handle = 0;
      }
      /**
       * @param samples {Float32Array}
       */
      push(samples) {
        const pointer = this.Module._malloc(samples.length * samples.BYTES_PER_ELEMENT);
        this.Module.HEAPF32.set(samples, pointer / samples.BYTES_PER_ELEMENT);
        this.Module._SherpaOnnxCircularBufferPush(
          this.handle,
          pointer,
          samples.length
        );
        this.Module._free(pointer);
      }
      get(startIndex, n) {
        const p = this.Module._SherpaOnnxCircularBufferGet(this.handle, startIndex, n);
        const samplesPtr = p / 4;
        const samples = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          samples[i] = this.Module.HEAPF32[samplesPtr + i];
        }
        this.Module._SherpaOnnxCircularBufferFree(p);
        return samples;
      }
      pop(n) {
        this.Module._SherpaOnnxCircularBufferPop(this.handle, n);
      }
      size() {
        return this.Module._SherpaOnnxCircularBufferSize(this.handle);
      }
      head() {
        return this.Module._SherpaOnnxCircularBufferHead(this.handle);
      }
      reset() {
        this.Module._SherpaOnnxCircularBufferReset(this.handle);
      }
    };
    var Vad = class {
      constructor(configObj, Module) {
        this.config = configObj;
        const config = initSherpaOnnxVadModelConfig(configObj, Module);
        const handle = Module._SherpaOnnxCreateVoiceActivityDetector(
          config.ptr,
          configObj.bufferSizeInSeconds || 30
        );
        freeConfig(config, Module);
        this.handle = handle;
        this.Module = Module;
      }
      free() {
        this.Module._SherpaOnnxDestroyVoiceActivityDetector(this.handle);
        this.handle = 0;
      }
      // samples is a float32 array
      acceptWaveform(samples) {
        const pointer = this.Module._malloc(samples.length * samples.BYTES_PER_ELEMENT);
        this.Module.HEAPF32.set(samples, pointer / samples.BYTES_PER_ELEMENT);
        this.Module._SherpaOnnxVoiceActivityDetectorAcceptWaveform(
          this.handle,
          pointer,
          samples.length
        );
        this.Module._free(pointer);
      }
      isEmpty() {
        return this.Module._SherpaOnnxVoiceActivityDetectorEmpty(this.handle) == 1;
      }
      isDetected() {
        return this.Module._SherpaOnnxVoiceActivityDetectorDetected(this.handle) == 1;
      }
      pop() {
        this.Module._SherpaOnnxVoiceActivityDetectorPop(this.handle);
      }
      clear() {
        this.Module._SherpaOnnxVoiceActivityDetectorClear(this.handle);
      }
      /*
      {
        samples: a 1-d float32 array,
        start: an int32
      }
         */
      front() {
        const h = this.Module._SherpaOnnxVoiceActivityDetectorFront(this.handle);
        const start = this.Module.HEAP32[h / 4];
        const samplesPtr = this.Module.HEAP32[h / 4 + 1] / 4;
        const numSamples = this.Module.HEAP32[h / 4 + 2];
        const samples = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
          samples[i] = this.Module.HEAPF32[samplesPtr + i];
        }
        this.Module._SherpaOnnxDestroySpeechSegment(h);
        return { samples, start };
      }
      reset() {
        this.Module._SherpaOnnxVoiceActivityDetectorReset(this.handle);
      }
      flush() {
        this.Module._SherpaOnnxVoiceActivityDetectorFlush(this.handle);
      }
    };
    if (typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string") {
      module2.exports = {
        createVad,
        CircularBuffer
      };
    }
  }
});

// node_modules/sherpa-onnx/sherpa-onnx-punctuation.js
var require_sherpa_onnx_punctuation = __commonJS({
  "node_modules/sherpa-onnx/sherpa-onnx-punctuation.js"(exports2, module2) {
    function freeConfig(config, Module) {
      if ("buffer" in config) {
        Module._free(config.buffer);
      }
      if ("config" in config) {
        freeConfig(config.config, Module);
      }
      Module._free(config.ptr);
    }
    function initSherpaOnnxOfflinePunctuationModelConfig(config, Module) {
      const model = config.ctTransformer || "";
      const modelLen = Module.lengthBytesUTF8(model) + 1;
      const provider = config.provider || "cpu";
      const providerLen = Module.lengthBytesUTF8(provider) + 1;
      const n = modelLen + providerLen;
      const buffer = Module._malloc(n);
      const len = 4 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(model, buffer + offset, modelLen);
      offset += modelLen;
      Module.stringToUTF8(provider, buffer + offset, providerLen);
      offset = 0;
      Module.setValue(ptr + offset, buffer + offset, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.numThreads || 1, "i32");
      offset += 4;
      Module.setValue(ptr + offset, config.debug || 0, "i32");
      offset += 4;
      Module.setValue(ptr + offset, buffer + modelLen, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflinePunctuationConfig(config, Module) {
      if (!("model" in config)) {
        config.model = {};
      }
      const modelConfig = initSherpaOnnxOfflinePunctuationModelConfig(config.model, Module);
      const len = modelConfig.len;
      const ptr = Module._malloc(len);
      Module._CopyHeap(modelConfig.ptr, modelConfig.len, ptr);
      return {
        ptr,
        len,
        config: modelConfig
      };
    }
    function initSherpaOnnxOnlinePunctuationModelConfig(config, Module) {
      const model = config.cnnBilstm || "";
      const modelLen = Module.lengthBytesUTF8(model) + 1;
      const bpeVocab = config.bpeVocab || "";
      const bpeVocabLen = Module.lengthBytesUTF8(bpeVocab) + 1;
      const provider = config.provider || "cpu";
      const providerLen = Module.lengthBytesUTF8(provider) + 1;
      const n = modelLen + bpeVocabLen + providerLen;
      const buffer = Module._malloc(n);
      const len = 5 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(model, buffer + offset, modelLen);
      offset += modelLen;
      Module.stringToUTF8(bpeVocab, buffer + offset, bpeVocabLen);
      offset += bpeVocabLen;
      Module.stringToUTF8(provider, buffer + offset, providerLen);
      offset = 0;
      Module.setValue(ptr + offset, buffer + offset, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, buffer + modelLen, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.numThreads || 1, "i32");
      offset += 4;
      Module.setValue(ptr + offset, config.debug || 0, "i32");
      offset += 4;
      Module.setValue(ptr + offset, buffer + modelLen + bpeVocabLen, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOnlinePunctuationConfig(config, Module) {
      if (!("model" in config)) {
        config.model = {};
      }
      const modelConfig = initSherpaOnnxOnlinePunctuationModelConfig(config.model, Module);
      const len = modelConfig.len;
      const ptr = Module._malloc(len);
      Module._CopyHeap(modelConfig.ptr, modelConfig.len, ptr);
      return {
        ptr,
        len,
        config: modelConfig
      };
    }
    function copyTextAndFree(ptr, freeFn, Module) {
      if (!ptr) {
        return "";
      }
      const text = Module.UTF8ToString(ptr);
      freeFn.call(Module, ptr);
      return text;
    }
    var OfflinePunctuation = class {
      constructor(configObj, Module) {
        const config = initSherpaOnnxOfflinePunctuationConfig(configObj, Module);
        const handle = Module._SherpaOnnxCreateOfflinePunctuation(config.ptr);
        freeConfig(config, Module);
        this.handle = handle;
        this.Module = Module;
      }
      free() {
        this.Module._SherpaOnnxDestroyOfflinePunctuation(this.handle);
        this.handle = 0;
      }
      addPunct(text) {
        const textLen = this.Module.lengthBytesUTF8(text) + 1;
        const textPtr = this.Module._malloc(textLen);
        this.Module.stringToUTF8(text, textPtr, textLen);
        const out = this.Module._SherpaOfflinePunctuationAddPunct(
          this.handle,
          textPtr
        );
        this.Module._free(textPtr);
        return copyTextAndFree(
          out,
          this.Module._SherpaOfflinePunctuationFreeText,
          this.Module
        );
      }
    };
    var OnlinePunctuation = class {
      constructor(configObj, Module) {
        const config = initSherpaOnnxOnlinePunctuationConfig(configObj, Module);
        const handle = Module._SherpaOnnxCreateOnlinePunctuation(config.ptr);
        freeConfig(config, Module);
        this.handle = handle;
        this.Module = Module;
      }
      free() {
        this.Module._SherpaOnnxDestroyOnlinePunctuation(this.handle);
        this.handle = 0;
      }
      addPunct(text) {
        const textLen = this.Module.lengthBytesUTF8(text) + 1;
        const textPtr = this.Module._malloc(textLen);
        this.Module.stringToUTF8(text, textPtr, textLen);
        const out = this.Module._SherpaOnnxOnlinePunctuationAddPunct(
          this.handle,
          textPtr
        );
        this.Module._free(textPtr);
        return copyTextAndFree(
          out,
          this.Module._SherpaOnnxOnlinePunctuationFreeText,
          this.Module
        );
      }
    };
    module2.exports = {
      OfflinePunctuation,
      OnlinePunctuation
    };
  }
});

// node_modules/sherpa-onnx/sherpa-onnx-speaker-diarization.js
var require_sherpa_onnx_speaker_diarization = __commonJS({
  "node_modules/sherpa-onnx/sherpa-onnx-speaker-diarization.js"(exports2, module2) {
    function freeConfig(config, Module) {
      if ("buffer" in config) {
        Module._free(config.buffer);
      }
      if ("config" in config) {
        freeConfig(config.config, Module);
      }
      if ("segmentation" in config) {
        freeConfig(config.segmentation, Module);
      }
      if ("embedding" in config) {
        freeConfig(config.embedding, Module);
      }
      if ("clustering" in config) {
        freeConfig(config.clustering, Module);
      }
      Module._free(config.ptr);
    }
    function initSherpaOnnxOfflineSpeakerSegmentationPyannoteModelConfig(config, Module) {
      const modelLen = Module.lengthBytesUTF8(config.model || "") + 1;
      const n = modelLen;
      const buffer = Module._malloc(n);
      const len = 1 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(config.model || "", buffer + offset, modelLen);
      offset += modelLen;
      offset = 0;
      Module.setValue(ptr, buffer + offset, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineSpeakerSegmentationModelConfig(config, Module) {
      if (!("pyannote" in config)) {
        config.pyannote = {
          model: ""
        };
      }
      const pyannote = initSherpaOnnxOfflineSpeakerSegmentationPyannoteModelConfig(
        config.pyannote,
        Module
      );
      const len = pyannote.len + 3 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module._CopyHeap(pyannote.ptr, pyannote.len, ptr + offset);
      offset += pyannote.len;
      Module.setValue(ptr + offset, config.numThreads || 1, "i32");
      offset += 4;
      Module.setValue(ptr + offset, config.debug || 0, "i32");
      offset += 4;
      const providerLen = Module.lengthBytesUTF8(config.provider || "cpu") + 1;
      const buffer = Module._malloc(providerLen);
      Module.stringToUTF8(config.provider || "cpu", buffer, providerLen);
      Module.setValue(ptr + offset, buffer, "i8*");
      return {
        buffer,
        ptr,
        len,
        config: pyannote
      };
    }
    function initSherpaOnnxSpeakerEmbeddingExtractorConfig(config, Module) {
      const modelLen = Module.lengthBytesUTF8(config.model || "") + 1;
      const providerLen = Module.lengthBytesUTF8(config.provider || "cpu") + 1;
      const n = modelLen + providerLen;
      const buffer = Module._malloc(n);
      const len = 4 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(config.model || "", buffer + offset, modelLen);
      offset += modelLen;
      Module.stringToUTF8(config.provider || "cpu", buffer + offset, providerLen);
      offset += providerLen;
      offset = 0;
      Module.setValue(ptr + offset, buffer, "i8*");
      offset += 4;
      Module.setValue(ptr + offset, config.numThreads || 1, "i32");
      offset += 4;
      Module.setValue(ptr + offset, config.debug || 0, "i32");
      offset += 4;
      Module.setValue(ptr + offset, buffer + modelLen, "i8*");
      offset += 4;
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxFastClusteringConfig(config, Module) {
      const len = 2 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.setValue(ptr + offset, config.numClusters || -1, "i32");
      offset += 4;
      Module.setValue(ptr + offset, config.threshold || 0.5, "float");
      offset += 4;
      return {
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineSpeakerDiarizationConfig(config, Module) {
      if (!("segmentation" in config)) {
        config.segmentation = {
          pyannote: { model: "" },
          numThreads: 1,
          debug: 0,
          provider: "cpu"
        };
      }
      if (!("embedding" in config)) {
        config.embedding = {
          model: "",
          numThreads: 1,
          debug: 0,
          provider: "cpu"
        };
      }
      if (!("clustering" in config)) {
        config.clustering = {
          numClusters: -1,
          threshold: 0.5
        };
      }
      const segmentation = initSherpaOnnxOfflineSpeakerSegmentationModelConfig(
        config.segmentation,
        Module
      );
      const embedding = initSherpaOnnxSpeakerEmbeddingExtractorConfig(config.embedding, Module);
      const clustering = initSherpaOnnxFastClusteringConfig(config.clustering, Module);
      const len = segmentation.len + embedding.len + clustering.len + 2 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module._CopyHeap(segmentation.ptr, segmentation.len, ptr + offset);
      offset += segmentation.len;
      Module._CopyHeap(embedding.ptr, embedding.len, ptr + offset);
      offset += embedding.len;
      Module._CopyHeap(clustering.ptr, clustering.len, ptr + offset);
      offset += clustering.len;
      Module.setValue(ptr + offset, config.minDurationOn || 0.2, "float");
      offset += 4;
      Module.setValue(ptr + offset, config.minDurationOff || 0.5, "float");
      offset += 4;
      return {
        ptr,
        len,
        segmentation,
        embedding,
        clustering
      };
    }
    var OfflineSpeakerDiarization = class {
      constructor(configObj, Module) {
        const config = initSherpaOnnxOfflineSpeakerDiarizationConfig(configObj, Module);
        const handle = Module._SherpaOnnxCreateOfflineSpeakerDiarization(config.ptr);
        freeConfig(config, Module);
        this.handle = handle;
        this.sampleRate = Module._SherpaOnnxOfflineSpeakerDiarizationGetSampleRate(this.handle);
        this.Module = Module;
        this.config = configObj;
      }
      free() {
        this.Module._SherpaOnnxDestroyOfflineSpeakerDiarization(this.handle);
        this.handle = 0;
      }
      setConfig(configObj) {
        if (!("clustering" in configObj)) {
          return;
        }
        const config = initSherpaOnnxOfflineSpeakerDiarizationConfig(configObj, this.Module);
        this.Module._SherpaOnnxOfflineSpeakerDiarizationSetConfig(
          this.handle,
          config.ptr
        );
        freeConfig(config, this.Module);
        this.config.clustering = configObj.clustering;
      }
      process(samples) {
        const pointer = this.Module._malloc(samples.length * samples.BYTES_PER_ELEMENT);
        this.Module.HEAPF32.set(samples, pointer / samples.BYTES_PER_ELEMENT);
        let r = this.Module._SherpaOnnxOfflineSpeakerDiarizationProcess(
          this.handle,
          pointer,
          samples.length
        );
        this.Module._free(pointer);
        let numSegments = this.Module._SherpaOnnxOfflineSpeakerDiarizationResultGetNumSegments(r);
        let segments = this.Module._SherpaOnnxOfflineSpeakerDiarizationResultSortByStartTime(
          r
        );
        let ans = [];
        let sizeOfSegment = 3 * 4;
        for (let i = 0; i < numSegments; ++i) {
          let p = segments + i * sizeOfSegment;
          let start = this.Module.HEAPF32[p / 4 + 0];
          let end = this.Module.HEAPF32[p / 4 + 1];
          let speaker = this.Module.HEAP32[p / 4 + 2];
          ans.push({ start, end, speaker });
        }
        this.Module._SherpaOnnxOfflineSpeakerDiarizationDestroySegment(segments);
        this.Module._SherpaOnnxOfflineSpeakerDiarizationDestroyResult(r);
        return ans;
      }
    };
    function createOfflineSpeakerDiarization(Module, myConfig) {
      let config = {
        segmentation: {
          pyannote: { model: "./segmentation.onnx" },
          debug: 1
        },
        embedding: {
          model: "./embedding.onnx",
          debug: 1
        },
        clustering: { numClusters: -1, threshold: 0.5 },
        minDurationOn: 0.3,
        minDurationOff: 0.5
      };
      if (myConfig) {
        config = myConfig;
      }
      return new OfflineSpeakerDiarization(config, Module);
    }
    if (typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string") {
      module2.exports = {
        createOfflineSpeakerDiarization
      };
    }
  }
});

// node_modules/sherpa-onnx/sherpa-onnx-speech-enhancement.js
var require_sherpa_onnx_speech_enhancement = __commonJS({
  "node_modules/sherpa-onnx/sherpa-onnx-speech-enhancement.js"(exports2, module2) {
    function freeConfig(config, Module) {
      if ("buffer" in config) {
        Module._free(config.buffer);
      }
      if ("config" in config) {
        freeConfig(config.config, Module);
      }
      if ("gtcrn" in config) {
        freeConfig(config.gtcrn, Module);
      }
      if ("dpdfnet" in config) {
        freeConfig(config.dpdfnet, Module);
      }
      Module._free(config.ptr);
    }
    function initSherpaOnnxOfflineSpeechDenoiserGtcrnModelConfig(config, Module) {
      if (!("model" in config)) {
        config.model = "";
      }
      const modelLen = Module.lengthBytesUTF8(config.model) + 1;
      const n = modelLen;
      const buffer = Module._malloc(n);
      const len = 1 * 4;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module.stringToUTF8(config.model, buffer + offset, modelLen);
      offset += modelLen;
      offset = 0;
      Module.setValue(ptr, buffer + offset, "i8*");
      offset += modelLen;
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineSpeechDenoiserDpdfNetModelConfig(config, Module) {
      if (!("model" in config)) {
        config.model = "";
      }
      const modelLen = Module.lengthBytesUTF8(config.model) + 1;
      const n = modelLen;
      const buffer = Module._malloc(n);
      const len = 1 * 4;
      const ptr = Module._malloc(len);
      Module.stringToUTF8(config.model, buffer, modelLen);
      Module.setValue(ptr, buffer, "i8*");
      return {
        buffer,
        ptr,
        len
      };
    }
    function initSherpaOnnxOfflineSpeechDenoiserModelConfig(config, Module) {
      if (!("gtcrn" in config)) {
        config.gtcrn = { model: "" };
      }
      if (!("dpdfnet" in config)) {
        config.dpdfnet = { model: "" };
      }
      const gtcrn = initSherpaOnnxOfflineSpeechDenoiserGtcrnModelConfig(config.gtcrn, Module);
      const dpdfnet = initSherpaOnnxOfflineSpeechDenoiserDpdfNetModelConfig(
        config.dpdfnet,
        Module
      );
      const len = gtcrn.len + 3 * 4 + dpdfnet.len;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module._CopyHeap(gtcrn.ptr, gtcrn.len, ptr + offset);
      offset += gtcrn.len;
      Module.setValue(ptr + offset, config.numThreads || 1, "i32");
      offset += 4;
      Module.setValue(ptr + offset, config.debug || 0, "i32");
      offset += 4;
      const providerLen = Module.lengthBytesUTF8(config.provider || "cpu") + 1;
      const buffer = Module._malloc(providerLen);
      Module.stringToUTF8(config.provider || "cpu", buffer, providerLen);
      Module.setValue(ptr + offset, buffer, "i8*");
      offset += 4;
      Module._CopyHeap(dpdfnet.ptr, dpdfnet.len, ptr + offset);
      offset += dpdfnet.len;
      return {
        buffer,
        ptr,
        len,
        gtcrn,
        dpdfnet
      };
    }
    function initSherpaOnnxOfflineSpeechDenoiserConfig(config, Module) {
      if (!("model" in config)) {
        config.model = {
          gtcrn: { model: "" },
          dpdfnet: { model: "" },
          provider: "cpu",
          debug: 1,
          numThreads: 1
        };
      }
      const modelConfig = initSherpaOnnxOfflineSpeechDenoiserModelConfig(config.model, Module);
      const len = modelConfig.len;
      const ptr = Module._malloc(len);
      let offset = 0;
      Module._CopyHeap(modelConfig.ptr, modelConfig.len, ptr + offset);
      offset += modelConfig.len;
      return {
        ptr,
        len,
        config: modelConfig
      };
    }
    function copyDenoisedAudio(handle, Module) {
      const numSamples = Module.HEAP32[handle / 4 + 1];
      const denoisedSampleRate = Module.HEAP32[handle / 4 + 2];
      const samplesPtr = Module.HEAP32[handle / 4] / 4;
      const denoisedSamples = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        denoisedSamples[i] = Module.HEAPF32[samplesPtr + i];
      }
      Module._SherpaOnnxDestroyDenoisedAudio(handle);
      return { samples: denoisedSamples, sampleRate: denoisedSampleRate };
    }
    var SpeechDenoiserBase = class {
      constructor(Module) {
        this.Module = Module;
      }
      save(filename, audio) {
        const samples = audio.samples;
        const sampleRate = audio.sampleRate;
        const ptr = this.Module._malloc(samples.length * 4);
        for (let i = 0; i < samples.length; i++) {
          this.Module.HEAPF32[ptr / 4 + i] = samples[i];
        }
        const filenameLen = this.Module.lengthBytesUTF8(filename) + 1;
        const buffer = this.Module._malloc(filenameLen);
        this.Module.stringToUTF8(filename, buffer, filenameLen);
        this.Module._SherpaOnnxWriteWave(ptr, samples.length, sampleRate, buffer);
        this.Module._free(buffer);
        this.Module._free(ptr);
      }
    };
    var OfflineSpeechDenoiser = class extends SpeechDenoiserBase {
      constructor(configObj, Module) {
        super(Module);
        const config = initSherpaOnnxOfflineSpeechDenoiserConfig(configObj, Module);
        const handle = Module._SherpaOnnxCreateOfflineSpeechDenoiser(config.ptr);
        freeConfig(config, Module);
        this.handle = handle;
        this.sampleRate = Module._SherpaOnnxOfflineSpeechDenoiserGetSampleRate(this.handle);
      }
      free() {
        this.Module._SherpaOnnxDestroyOfflineSpeechDenoiser(this.handle);
        this.handle = 0;
      }
      run(samples, sampleRate) {
        const pointer = this.Module._malloc(samples.length * samples.BYTES_PER_ELEMENT);
        this.Module.HEAPF32.set(samples, pointer / samples.BYTES_PER_ELEMENT);
        const h = this.Module._SherpaOnnxOfflineSpeechDenoiserRun(
          this.handle,
          pointer,
          samples.length,
          sampleRate
        );
        this.Module._free(pointer);
        return copyDenoisedAudio(h, this.Module);
      }
    };
    var OnlineSpeechDenoiser = class extends SpeechDenoiserBase {
      constructor(configObj, Module) {
        super(Module);
        const config = initSherpaOnnxOfflineSpeechDenoiserConfig(configObj, Module);
        const handle = Module._SherpaOnnxCreateOnlineSpeechDenoiser(config.ptr);
        freeConfig(config, Module);
        this.handle = handle;
        this.sampleRate = Module._SherpaOnnxOnlineSpeechDenoiserGetSampleRate(this.handle);
        this.frameShiftInSamples = Module._SherpaOnnxOnlineSpeechDenoiserGetFrameShiftInSamples(
          this.handle
        );
      }
      free() {
        this.Module._SherpaOnnxDestroyOnlineSpeechDenoiser(this.handle);
        this.handle = 0;
      }
      run(samples, sampleRate) {
        const pointer = this.Module._malloc(samples.length * samples.BYTES_PER_ELEMENT);
        this.Module.HEAPF32.set(samples, pointer / samples.BYTES_PER_ELEMENT);
        const h = this.Module._SherpaOnnxOnlineSpeechDenoiserRun(
          this.handle,
          pointer,
          samples.length,
          sampleRate
        );
        this.Module._free(pointer);
        return copyDenoisedAudio(h, this.Module);
      }
      flush() {
        const h = this.Module._SherpaOnnxOnlineSpeechDenoiserFlush(this.handle);
        return copyDenoisedAudio(h, this.Module);
      }
      reset() {
        this.Module._SherpaOnnxOnlineSpeechDenoiserReset(this.handle);
      }
    };
    function createOfflineSpeechDenoiser(Module, myConfig) {
      let config = {
        model: {
          gtcrn: { model: "./gtcrn.onnx" },
          debug: 0
        }
      };
      if (myConfig) {
        config = myConfig;
      }
      return new OfflineSpeechDenoiser(config, Module);
    }
    function createOnlineSpeechDenoiser(Module, myConfig) {
      let config = {
        model: {
          gtcrn: { model: "./gtcrn.onnx" },
          debug: 0
        }
      };
      if (myConfig) {
        config = myConfig;
      }
      return new OnlineSpeechDenoiser(config, Module);
    }
    if (typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string") {
      module2.exports = {
        createOfflineSpeechDenoiser,
        createOnlineSpeechDenoiser
      };
    }
  }
});

// node_modules/sherpa-onnx/index.js
var require_sherpa_onnx = __commonJS({
  "node_modules/sherpa-onnx/index.js"(exports2, module2) {
    "use strict";
    var wasmModule = require_sherpa_onnx_wasm_nodejs()();
    var sherpa_onnx_asr = require_sherpa_onnx_asr();
    var sherpa_onnx_tts = require_sherpa_onnx_tts();
    var sherpa_onnx_kws = require_sherpa_onnx_kws();
    var sherpa_onnx_wave = require_sherpa_onnx_wave();
    var sherpa_onnx_vad = require_sherpa_onnx_vad();
    var sherpa_onnx_punctuation = require_sherpa_onnx_punctuation();
    var sherpa_onnx_speaker_diarization = require_sherpa_onnx_speaker_diarization();
    var sherpa_onnx_speech_enhancement = require_sherpa_onnx_speech_enhancement();
    function createOnlineRecognizer(config) {
      return sherpa_onnx_asr.createOnlineRecognizer(wasmModule, config);
    }
    function createOfflineRecognizer(config) {
      return new sherpa_onnx_asr.OfflineRecognizer(config, wasmModule);
    }
    function createOfflineTts(config) {
      return sherpa_onnx_tts.createOfflineTts(wasmModule, config);
    }
    function createKws(config) {
      return sherpa_onnx_kws.createKws(wasmModule, config);
    }
    function createCircularBuffer(capacity) {
      return new sherpa_onnx_vad.CircularBuffer(capacity, wasmModule);
    }
    function createVad(config) {
      return sherpa_onnx_vad.createVad(wasmModule, config);
    }
    function createOfflinePunctuation(config) {
      return new sherpa_onnx_punctuation.OfflinePunctuation(config, wasmModule);
    }
    function createOnlinePunctuation(config) {
      return new sherpa_onnx_punctuation.OnlinePunctuation(config, wasmModule);
    }
    function createOfflineSpeakerDiarization(config) {
      return sherpa_onnx_speaker_diarization.createOfflineSpeakerDiarization(
        wasmModule,
        config
      );
    }
    function readWave(filename) {
      return sherpa_onnx_wave.readWave(filename, wasmModule);
    }
    function writeWave(filename, data) {
      sherpa_onnx_wave.writeWave(filename, data, wasmModule);
    }
    function readWaveFromBinaryData(uint8Array) {
      return sherpa_onnx_wave.readWaveFromBinaryData(uint8Array, wasmModule);
    }
    function createOfflineSpeechDenoiser(config) {
      return sherpa_onnx_speech_enhancement.createOfflineSpeechDenoiser(
        wasmModule,
        config
      );
    }
    function createOnlineSpeechDenoiser(config) {
      return sherpa_onnx_speech_enhancement.createOnlineSpeechDenoiser(
        wasmModule,
        config
      );
    }
    function getVersion() {
      const v = wasmModule._SherpaOnnxGetVersionStr();
      return wasmModule.UTF8ToString(v);
    }
    function getGitSha1() {
      const v = wasmModule._SherpaOnnxGetGitSha1();
      return wasmModule.UTF8ToString(v);
    }
    function getGitDate() {
      const v = wasmModule._SherpaOnnxGetGitDate();
      return wasmModule.UTF8ToString(v);
    }
    module2.exports = {
      createOnlineRecognizer,
      createOfflineRecognizer,
      createOfflineTts,
      createKws,
      readWave,
      readWaveFromBinaryData,
      writeWave,
      createCircularBuffer,
      createVad,
      createOfflinePunctuation,
      createOnlinePunctuation,
      createOfflineSpeakerDiarization,
      createOfflineSpeechDenoiser,
      createOnlineSpeechDenoiser,
      version: getVersion(),
      gitSha1: getGitSha1(),
      gitDate: getGitDate()
    };
  }
});

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MeetNotePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/settings.ts
var import_obsidian2 = require("obsidian");
var DEFAULT_SETTINGS = {
  language: "ko",
  minSpeakers: null,
  maxSpeakers: null,
  slackEnabled: false,
  slackWebhookUrl: "",
  encryptionEnabled: false,
  autoDeleteDays: 0,
  autoLinkEnabled: true
};
var MeetNoteSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "MeetNote \uC124\uC815" });
    new import_obsidian2.Setting(containerEl).setName("\uC804\uC0AC \uC5B8\uC5B4").setDesc("\uC74C\uC131 \uC778\uC2DD \uC5B8\uC5B4").addDropdown(
      (dropdown) => dropdown.addOption("ko", "\uD55C\uAD6D\uC5B4").addOption("en", "English").addOption("ja", "\u65E5\u672C\u8A9E").addOption("zh", "\u4E2D\u6587").setValue(this.plugin.settings.language).onChange(async (value) => {
        this.plugin.settings.language = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\uCD5C\uC18C \uD654\uC790 \uC218").setDesc("\uC608\uC0C1 \uCD5C\uC18C \uD654\uC790 \uC218 (\uBE44\uC6CC\uB450\uBA74 \uC790\uB3D9 \uAC10\uC9C0)").addText(
      (text) => text.setPlaceholder("\uC790\uB3D9 \uAC10\uC9C0").setValue(
        this.plugin.settings.minSpeakers !== null ? String(this.plugin.settings.minSpeakers) : ""
      ).onChange(async (value) => {
        this.plugin.settings.minSpeakers = value === "" ? null : parseInt(value, 10) || null;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\uCD5C\uB300 \uD654\uC790 \uC218").setDesc("\uC608\uC0C1 \uCD5C\uB300 \uD654\uC790 \uC218 (\uBE44\uC6CC\uB450\uBA74 \uC790\uB3D9 \uAC10\uC9C0)").addText(
      (text) => text.setPlaceholder("\uC790\uB3D9 \uAC10\uC9C0").setValue(
        this.plugin.settings.maxSpeakers !== null ? String(this.plugin.settings.maxSpeakers) : ""
      ).onChange(async (value) => {
        this.plugin.settings.maxSpeakers = value === "" ? null : parseInt(value, 10) || null;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h2", { text: "Slack \uC5F0\uB3D9" });
    new import_obsidian2.Setting(containerEl).setName("Slack \uC804\uC1A1 \uD65C\uC131\uD654").setDesc("\uD68C\uC758 \uC644\uB8CC \uD6C4 Slack \uCC44\uB110\uB85C \uD68C\uC758\uB85D \uC790\uB3D9 \uC804\uC1A1").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.slackEnabled).onChange(async (value) => {
        this.plugin.settings.slackEnabled = value;
        await this.plugin.saveSettings();
        await this.syncSlackConfig();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Webhook URL").setDesc("Slack Incoming Webhook URL (Slack \uC571 \uC124\uC815\uC5D0\uC11C \uC0DD\uC131)").addText(
      (text) => text.setPlaceholder("https://hooks.slack.com/services/...").setValue(this.plugin.settings.slackWebhookUrl).onChange(async (value) => {
        this.plugin.settings.slackWebhookUrl = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\uC5F0\uACB0 \uD14C\uC2A4\uD2B8").setDesc("Slack Webhook \uC5F0\uACB0 \uC0C1\uD0DC\uB97C \uD655\uC778\uD569\uB2C8\uB2E4").addButton(
      (button) => button.setButtonText("\uD14C\uC2A4\uD2B8").onClick(async () => {
        const { testSlackConnection: testSlackConnection2 } = (init_slack_sender(), __toCommonJS(slack_sender_exports));
        const result = await testSlackConnection2(this.plugin.settings.slackWebhookUrl);
        if (result.success) {
          new import_obsidian2.Notice("Slack \uC5F0\uACB0 \uC131\uACF5! \uCC44\uB110\uC744 \uD655\uC778\uD558\uC138\uC694.");
        } else {
          new import_obsidian2.Notice(`Slack \uC5F0\uACB0 \uC2E4\uD328: ${result.error}`);
        }
      })
    );
    containerEl.createEl("h2", { text: "\uBCF4\uC548" });
    new import_obsidian2.Setting(containerEl).setName("\uB179\uC74C \uD30C\uC77C \uC554\uD638\uD654").setDesc("\uB179\uC74C \uC644\uB8CC \uD6C4 WAV \uD30C\uC77C\uC744 AES \uC554\uD638\uD654\uD558\uC5EC \uC800\uC7A5 (\uC6D0\uBCF8 \uC0AD\uC81C)").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.encryptionEnabled).onChange(async (value) => {
        this.plugin.settings.encryptionEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\uC790\uB3D9 \uC0AD\uC81C (\uC77C)").setDesc("N\uC77C \uC774\uC0C1 \uB41C \uB179\uC74C \uD30C\uC77C \uC790\uB3D9 \uC0AD\uC81C (0\uC774\uBA74 \uBE44\uD65C\uC131\uD654)").addText(
      (text) => text.setPlaceholder("0").setValue(String(this.plugin.settings.autoDeleteDays)).onChange(async (value) => {
        this.plugin.settings.autoDeleteDays = parseInt(value, 10) || 0;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h2", { text: "\uC790\uB3D9 \uD0DC\uADF8 \uBC0F \uB9C1\uD06C" });
    new import_obsidian2.Setting(containerEl).setName("\uC790\uB3D9 \uD0DC\uADF8/\uB9C1\uD06C \uD65C\uC131\uD654").setDesc("\uD68C\uC758 \uC644\uB8CC \uD6C4 \uD0A4\uC6CC\uB4DC \uD0DC\uADF8 \uC0DD\uC131 \uBC0F \uC5F0\uAD00 \uD68C\uC758 [[\uB9C1\uD06C]] \uC790\uB3D9 \uC0BD\uC785").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoLinkEnabled).onChange(async (value) => {
        this.plugin.settings.autoLinkEnabled = value;
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/writer.ts
var LIVE_MARKER_START = "<!-- meetnote-live-start -->";
var LIVE_MARKER_END = "<!-- meetnote-live-end -->";
var SECTION_MARKER_START = "<!-- meetnote-start -->";
var SECTION_MARKER_END = "<!-- meetnote-end -->";
var RELATED_MARKER_START = "<!-- meetnote-related-start -->";
var RELATED_MARKER_END = "<!-- meetnote-related-end -->";
function pad2(n) {
  return String(n).padStart(2, "0");
}
function formatTime(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}
function formatDateTime(date) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  return `${y}-${m}-${d} ${h}:${min}`;
}
function formatDate(date) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}
function secondsToWallClock(seconds, startTime) {
  return new Date(startTime.getTime() + seconds * 1e3);
}
function extractTags(summary) {
  const tagSectionMatch = summary.match(/###\s*태그\s*\n([\s\S]*?)(?=\n###|\n##|$)/);
  if (!tagSectionMatch) return [];
  const tagLine = tagSectionMatch[1].trim();
  const tags = tagLine.match(/#[\w가-힣]+/g);
  return tags ? tags.map((t) => t.slice(1)) : [];
}
function extractFrontmatterTags(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return [];
  const tags = [];
  const lines = fmMatch[1].split("\n");
  let inTags = false;
  for (const line of lines) {
    if (/^tags:\s*$/.test(line)) {
      inTags = true;
      continue;
    }
    if (inTags) {
      const tagMatch = line.match(/^\s+-\s+(.+)/);
      if (tagMatch) {
        tags.push(tagMatch[1].trim());
      } else {
        inTags = false;
      }
    }
  }
  return tags;
}
function buildFrontmatter(tags, date, participants) {
  const lines = ["---"];
  lines.push("type: meeting");
  if (tags.length > 0) {
    lines.push("tags:");
    for (const tag of tags) {
      lines.push(`  - ${tag}`);
    }
  }
  lines.push(`date: ${date}`);
  if (participants.length > 0) {
    lines.push("participants:");
    for (const p of participants) {
      lines.push(`  - ${p}`);
    }
  }
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}
var MeetingWriter = class {
  constructor(app) {
    this.activeFile = null;
    this.startTime = null;
    this.lastTags = [];
    this.app = app;
  }
  get currentFile() {
    return this.activeFile;
  }
  get tags() {
    return this.lastTags;
  }
  async init(file, startTime) {
    this.activeFile = file;
    this.startTime = startTime;
    const liveSection = [
      "",
      SECTION_MARKER_START,
      "",
      "## \uD68C\uC758 \uB179\uCDE8\uB85D",
      "",
      LIVE_MARKER_START,
      LIVE_MARKER_END,
      "",
      SECTION_MARKER_END,
      ""
    ].join("\n");
    await this.app.vault.process(this.activeFile, (content) => {
      return content + liveSection;
    });
  }
  async appendChunk(segments) {
    if (!this.activeFile || !this.startTime) return;
    const lines = [];
    for (const seg of segments) {
      const wallClock = secondsToWallClock(seg.start, this.startTime);
      const ts = formatTime(wallClock);
      lines.push(`**[${ts}]** ${seg.text.trim()}`);
      lines.push("");
    }
    const newText = lines.join("\n");
    await this.app.vault.process(this.activeFile, (content) => {
      const markerIdx = content.lastIndexOf(LIVE_MARKER_END);
      if (markerIdx === -1) {
        return content + "\n" + newText;
      }
      return content.slice(0, markerIdx) + newText + content.slice(markerIdx);
    });
  }
  async writeFinal(segments, startTime, endTime, summary, speakingStats) {
    if (!this.activeFile) return;
    const speakerSet = /* @__PURE__ */ new Set();
    for (const seg of segments) {
      speakerSet.add(seg.speaker);
    }
    const speakers = Array.from(speakerSet);
    const speakerCount = speakers.length;
    const speakerLabels = speakers.map(
      (s) => s.startsWith("SPEAKER_") ? s.replace(/^SPEAKER_(\d+)$/, (_, n) => `\uD654\uC790${parseInt(n) + 1}`) : s
    );
    this.lastTags = summary ? extractTags(summary) : [];
    if (!this.lastTags.includes("\uD68C\uC758")) {
      this.lastTags.unshift("\uD68C\uC758");
    }
    const header = [
      "## \uD68C\uC758 \uB179\uCDE8\uB85D",
      "",
      `> \uB179\uC74C: ${formatDateTime(startTime)} ~ ${formatTime(endTime)}`,
      `> \uCC38\uC11D\uC790: ${speakerLabels.join(", ")} (\uC790\uB3D9 \uAC10\uC9C0 ${speakerCount}\uBA85)`,
      ""
    ];
    if (speakingStats && speakingStats.length > 0) {
      header.push("### \uBC1C\uC5B8 \uBE44\uC728");
      header.push("");
      for (const stat of speakingStats) {
        const pct = Math.round(stat.ratio * 100);
        const mins = Math.floor(stat.total_seconds / 60);
        const secs = Math.round(stat.total_seconds % 60);
        const barWidth = 20;
        const filled = Math.round(stat.ratio * barWidth);
        const bar = "\u2588".repeat(filled) + "\u2591".repeat(barWidth - filled);
        header.push(`> ${stat.speaker} ${pct}% ${bar} (${mins}\uBD84 ${secs}\uCD08)`);
      }
      header.push("");
    }
    const summarySection = [];
    if (summary && summary.trim()) {
      summarySection.push(summary.trim());
      summarySection.push("");
      summarySection.push("---");
      summarySection.push("");
    }
    const body = [];
    body.push("## \uB179\uCDE8\uB85D");
    body.push("");
    for (const seg of segments) {
      const wallClock = secondsToWallClock(seg.timestamp, startTime);
      const ts = formatTime(wallClock);
      const speakerLabel = seg.speaker.startsWith("SPEAKER_") ? seg.speaker.replace(/^SPEAKER_(\d+)$/, (_, n) => `\uD654\uC790${parseInt(n) + 1}`) : seg.speaker;
      body.push(`### ${ts}`);
      body.push(`**${speakerLabel}**: ${seg.text.trim()}`);
      body.push("");
    }
    const finalContent = [...header, ...summarySection, ...body].join("\n");
    const frontmatter = buildFrontmatter(
      this.lastTags,
      formatDate(startTime),
      speakerLabels
    );
    await this.app.vault.process(this.activeFile, (content) => {
      let cleanContent = content.replace(/^---\n[\s\S]*?\n---\n*/, "");
      const startIdx = cleanContent.indexOf(SECTION_MARKER_START);
      const endIdx = cleanContent.indexOf(SECTION_MARKER_END);
      let bodyContent;
      if (startIdx === -1 || endIdx === -1) {
        bodyContent = cleanContent + "\n" + finalContent;
      } else {
        bodyContent = cleanContent.slice(0, startIdx) + SECTION_MARKER_START + "\n\n" + finalContent + "\n" + cleanContent.slice(endIdx);
      }
      return frontmatter + bodyContent;
    });
  }
  /**
   * Find related meetings in the vault and add bidirectional [[links]].
   */
  async linkRelatedMeetings(minOverlap = 2) {
    if (!this.activeFile || this.lastTags.length === 0) return 0;
    const currentPath = this.activeFile.path;
    const currentTags = new Set(this.lastTags);
    const relatedFiles = [];
    const mdFiles = this.app.vault.getMarkdownFiles();
    for (const file of mdFiles) {
      if (file.path === currentPath) continue;
      const content = await this.app.vault.cachedRead(file);
      const fileTags = extractFrontmatterTags(content);
      if (fileTags.length === 0) continue;
      const commonTags = fileTags.filter((t) => currentTags.has(t));
      if (commonTags.length >= minOverlap) {
        relatedFiles.push({ file, commonTags });
      }
    }
    if (relatedFiles.length === 0) return 0;
    relatedFiles.sort((a, b) => b.commonTags.length - a.commonTags.length);
    const relatedLines = [
      "",
      RELATED_MARKER_START,
      "## \uC5F0\uAD00 \uD68C\uC758",
      ""
    ];
    for (const { file, commonTags } of relatedFiles.slice(0, 10)) {
      const name = file.basename;
      const tagStr = commonTags.map((t) => `#${t}`).join(", ");
      relatedLines.push(`- [[${name}]] (\uACF5\uD1B5: ${tagStr})`);
    }
    relatedLines.push("");
    relatedLines.push(RELATED_MARKER_END);
    await this.app.vault.process(this.activeFile, (content) => {
      const cleaned = content.replace(
        new RegExp(`\\n?${RELATED_MARKER_START}[\\s\\S]*?${RELATED_MARKER_END}\\n?`),
        ""
      );
      return cleaned + relatedLines.join("\n");
    });
    const currentName = this.activeFile.basename;
    for (const { file, commonTags } of relatedFiles.slice(0, 10)) {
      await this.app.vault.process(file, (content) => {
        if (content.includes(`[[${currentName}]]`)) return content;
        const tagStr = commonTags.map((t) => `#${t}`).join(", ");
        const linkLine = `- [[${currentName}]] (\uACF5\uD1B5: ${tagStr})`;
        const relStartIdx = content.indexOf(RELATED_MARKER_START);
        const relEndIdx = content.indexOf(RELATED_MARKER_END);
        if (relStartIdx !== -1 && relEndIdx !== -1) {
          return content.slice(0, relEndIdx) + linkLine + "\n" + content.slice(relEndIdx);
        }
        return content + "\n" + RELATED_MARKER_START + "\n## \uC5F0\uAD00 \uD68C\uC758\n\n" + linkLine + "\n" + RELATED_MARKER_END + "\n";
      });
    }
    return relatedFiles.length;
  }
  reset() {
    this.activeFile = null;
    this.startTime = null;
    this.lastTags = [];
  }
};

// src/recorder-view.ts
var RecorderStatusBar = class {
  constructor(statusBarEl) {
    this.timerInterval = null;
    this.recordingStartTime = null;
    this.connected = false;
    this.recording = false;
    this.processing = false;
    this.el = statusBarEl;
    this.setIdle();
  }
  // ── Public state updates ───────────────────────────────────────────
  /**
   * Update connection status display.
   */
  setConnectionStatus(connected) {
    this.connected = connected;
    if (!connected && !this.recording && !this.processing) {
      this.el.setText("\uC11C\uBC84 \uC5F0\uACB0 \uB04A\uAE40");
      this.el.style.display = "";
    } else if (connected && !this.recording && !this.processing) {
      this.setIdle();
    }
  }
  /**
   * Start showing the recording timer.
   */
  startRecording() {
    this.recording = true;
    this.processing = false;
    this.recordingStartTime = /* @__PURE__ */ new Date();
    this.el.style.display = "";
    this.clearTimer();
    this.updateElapsed();
    this.timerInterval = setInterval(() => this.updateElapsed(), 1e3);
  }
  /**
   * Stop the recording timer. Typically transitions to processing or idle.
   */
  stopRecording() {
    this.recording = false;
    this.clearTimer();
    this.recordingStartTime = null;
  }
  /**
   * Show post-processing progress (e.g., diarization).
   */
  setProgress(stage, percent) {
    this.processing = true;
    this.recording = false;
    this.clearTimer();
    this.el.style.display = "";
    const pct = Math.round(percent);
    this.el.setText(`\uD654\uC790 \uAD6C\uBD84 \uC911... ${pct}%`);
  }
  /**
   * Return to idle state.
   */
  setIdle() {
    this.recording = false;
    this.processing = false;
    this.clearTimer();
    this.recordingStartTime = null;
    if (!this.connected) {
      this.el.setText("\uC11C\uBC84 \uC5F0\uACB0 \uB04A\uAE40");
      this.el.style.display = "";
    } else {
      this.el.setText("");
      this.el.style.display = "none";
    }
  }
  /**
   * Clean up resources.
   */
  destroy() {
    this.clearTimer();
  }
  // ── Internal helpers ───────────────────────────────────────────────
  updateElapsed() {
    if (!this.recordingStartTime) return;
    const elapsed = Math.floor(
      (Date.now() - this.recordingStartTime.getTime()) / 1e3
    );
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    this.el.setText(`\u{1F534} \uB179\uC74C \uC911 ${mm}:${ss}`);
  }
  clearTimer() {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
};

// src/engine/audio-recorder.ts
var AudioRecorder = class {
  constructor(sampleRate = 16e3, chunkDuration = 30) {
    // seconds
    this.recording = false;
    this.chunks = [];
    this.chunkBuffer = [];
    this.chunkSamplesCollected = 0;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.startTime = 0;
    this.sampleRate = sampleRate;
    this.chunkDuration = chunkDuration;
  }
  get isRecording() {
    return this.recording;
  }
  get elapsed() {
    if (!this.recording) return 0;
    return (Date.now() - this.startTime) / 1e3;
  }
  /**
   * Start recording from the default microphone.
   * Uses Web Audio API (available in Electron/Obsidian).
   */
  async start(onChunk) {
    if (this.recording) return;
    this.chunkCallback = onChunk;
    this.chunks = [];
    this.chunkBuffer = [];
    this.chunkSamplesCollected = 0;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: { ideal: this.sampleRate },
        channelCount: { exact: 1 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    const source = this.audioContext.createMediaStreamSource(stream);
    const bufferSize = 4096;
    const processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
    processor.onaudioprocess = (event) => {
      if (!this.recording) return;
      const inputData = event.inputBuffer.getChannelData(0);
      const samples = new Float32Array(inputData);
      this.chunks.push(samples);
      this.chunkBuffer.push(samples);
      this.chunkSamplesCollected += samples.length;
      const chunkTarget = this.sampleRate * this.chunkDuration;
      if (this.chunkSamplesCollected >= chunkTarget && this.chunkCallback) {
        this.flushChunk();
      }
    };
    source.connect(processor);
    processor.connect(this.audioContext.destination);
    this.recording = true;
    this.startTime = Date.now();
    this.mediaRecorder = { stream, source, processor };
    console.log(`[AudioRecorder] Recording started (sr=${this.sampleRate}, chunk=${this.chunkDuration}s)`);
  }
  /** Stop recording and return all audio as a single Float32Array. */
  stop() {
    if (!this.recording) return null;
    this.recording = false;
    if (this.chunkBuffer.length > 0 && this.chunkCallback) {
      this.flushChunk();
    }
    if (this.mediaRecorder) {
      this.mediaRecorder.processor.disconnect();
      this.mediaRecorder.source.disconnect();
      this.mediaRecorder.stream.getTracks().forEach((t) => t.stop());
      this.mediaRecorder = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.chunks.length === 0) return null;
    const totalLength = this.chunks.reduce((sum, c) => sum + c.length, 0);
    const allSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      allSamples.set(chunk, offset);
      offset += chunk.length;
    }
    const elapsed = (Date.now() - this.startTime) / 1e3;
    console.log(`[AudioRecorder] Recording stopped (${elapsed.toFixed(1)}s, ${totalLength} samples)`);
    return { samples: allSamples, sampleRate: this.sampleRate };
  }
  flushChunk() {
    if (this.chunkBuffer.length === 0) return;
    const totalLength = this.chunkBuffer.reduce((sum, c) => sum + c.length, 0);
    const chunkSamples = new Float32Array(totalLength);
    let offset = 0;
    for (const buf of this.chunkBuffer) {
      chunkSamples.set(buf, offset);
      offset += buf.length;
    }
    this.chunkBuffer = [];
    this.chunkSamplesCollected = 0;
    this.chunkCallback?.({
      samples: chunkSamples,
      sampleRate: this.sampleRate
    });
  }
};

// src/engine/transcriber.ts
var path = __toESM(require("path"));
var Transcriber = class {
  constructor(modelManager, language = "ko") {
    this.recognizer = null;
    this.modelManager = modelManager;
    this.language = language;
  }
  /** Initialize the recognizer. Must be called before transcribe. */
  async init(onProgress) {
    const ok = await this.modelManager.ensureModel("whisper", onProgress);
    if (!ok) throw new Error("Whisper \uBAA8\uB378 \uB2E4\uC6B4\uB85C\uB4DC \uC2E4\uD328");
    const sherpa = require_sherpa_onnx();
    const modelDir = this.modelManager.getModelDir("whisper");
    this.recognizer = sherpa.createOfflineRecognizer({
      modelConfig: {
        whisper: {
          encoder: path.join(modelDir, "small-encoder.onnx"),
          decoder: path.join(modelDir, "small-decoder.onnx"),
          language: this.language,
          tailPaddings: -1
        },
        tokens: path.join(modelDir, "small-tokens.txt"),
        numThreads: 4,
        debug: false
      },
      decodingMethod: "greedy_search"
    });
    console.log("[Transcriber] sherpa-onnx recognizer ready");
  }
  /** Transcribe a WAV file buffer. Returns segments with timestamps. */
  transcribeBuffer(samples, sampleRate, timeOffset = 0) {
    if (!this.recognizer) throw new Error("Transcriber not initialized");
    const sherpa = require_sherpa_onnx();
    const stream = this.recognizer.createStream();
    stream.acceptWaveform({ sampleRate, samples });
    this.recognizer.decode(stream);
    const result = this.recognizer.getResult(stream);
    const text = (result.text || "").trim();
    if (!text) return [];
    const duration = samples.length / sampleRate;
    if (result.timestamps && result.timestamps.length > 0) {
      return this.parseTimestampedResult(result, timeOffset);
    }
    return [{
      start: timeOffset,
      end: timeOffset + duration,
      text
    }];
  }
  parseTimestampedResult(result, timeOffset) {
    const segments = [];
    const tokens = result.tokens || [];
    const timestamps = result.timestamps || [];
    if (tokens.length === 0) return [];
    let currentText = "";
    let segStart = timestamps[0] + timeOffset;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      currentText += token;
      const isPunctuation = /[.!?。！？]$/.test(currentText.trim());
      const isLast = i === tokens.length - 1;
      if ((isPunctuation || isLast) && currentText.trim()) {
        segments.push({
          start: segStart,
          end: (timestamps[i] || segStart) + timeOffset,
          text: currentText.trim()
        });
        currentText = "";
        if (i + 1 < timestamps.length) {
          segStart = timestamps[i + 1] + timeOffset;
        }
      }
    }
    return segments;
  }
  destroy() {
    this.recognizer = null;
  }
};

// src/engine/diarizer.ts
var path2 = __toESM(require("path"));
var Diarizer = class {
  // OfflineSpeakerDiarization instance
  constructor(modelManager) {
    this.sd = null;
    this.modelManager = modelManager;
  }
  /** Initialize the diarization pipeline. */
  async init(onProgress) {
    const segOk = await this.modelManager.ensureModel("segmentation", onProgress);
    const embOk = await this.modelManager.ensureModel("embedding", onProgress);
    if (!segOk || !embOk) throw new Error("\uD654\uC790\uAD6C\uBD84 \uBAA8\uB378 \uB2E4\uC6B4\uB85C\uB4DC \uC2E4\uD328");
    const sherpa = require_sherpa_onnx();
    const segDir = this.modelManager.getModelDir("segmentation");
    const embDir = this.modelManager.getModelDir("embedding");
    const config = {
      segmentation: {
        pyannote: {
          model: path2.join(segDir, "model.onnx")
        }
      },
      embedding: {
        model: path2.join(embDir, "3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx")
      },
      minDurationOn: 0.3,
      // minimum speech duration (seconds)
      minDurationOff: 0.5,
      // minimum silence duration (seconds)
      numThreads: 4
    };
    this.sd = sherpa.createOfflineSpeakerDiarization(config);
    console.log("[Diarizer] sherpa-onnx diarization pipeline ready");
    console.log(`[Diarizer] Expected sample rate: ${this.sd.sampleRate}`);
  }
  get sampleRate() {
    return this.sd?.sampleRate || 16e3;
  }
  /** Run diarization on audio samples. Returns speaker-attributed segments. */
  run(samples, sampleRate, minSpeakers, maxSpeakers) {
    if (!this.sd) throw new Error("Diarizer not initialized");
    if (sampleRate !== this.sd.sampleRate) {
      console.warn(`[Diarizer] Sample rate mismatch: ${sampleRate} vs ${this.sd.sampleRate}`);
      samples = this.resample(samples, sampleRate, this.sd.sampleRate);
    }
    this.sd.setMinNumSpeakers(minSpeakers || 1);
    this.sd.setMaxNumSpeakers(maxSpeakers || 6);
    const result = this.sd.process(samples);
    const segments = [];
    for (let i = 0; i < result.length; i++) {
      const seg = result[i];
      segments.push({
        start: seg.start,
        end: seg.end,
        speaker: `SPEAKER_${String(seg.speaker).padStart(2, "0")}`
      });
    }
    console.log(`[Diarizer] ${segments.length} segments, ${new Set(segments.map((s) => s.speaker)).size} speakers`);
    return segments;
  }
  resample(input, fromRate, toRate) {
    const ratio = toRate / fromRate;
    const newLength = Math.round(input.length * ratio);
    const output = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const srcIdx = i / ratio;
      const idx = Math.floor(srcIdx);
      const frac = srcIdx - idx;
      if (idx + 1 < input.length) {
        output[i] = input[idx] * (1 - frac) + input[idx + 1] * frac;
      } else {
        output[i] = input[Math.min(idx, input.length - 1)];
      }
    }
    return output;
  }
  destroy() {
    this.sd = null;
  }
};

// src/engine/model-manager.ts
var import_obsidian3 = require("obsidian");
var fs = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var MODELS = {
  whisper: {
    name: "Whisper small (multilingual)",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.tar.bz2",
    files: ["small-encoder.onnx", "small-decoder.onnx", "small-tokens.txt"],
    size: "~300MB"
  },
  segmentation: {
    name: "Speaker segmentation (pyannote)",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2",
    files: ["model.onnx"],
    size: "~5MB"
  },
  embedding: {
    name: "Speaker embedding (3D-Speaker)",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx",
    files: ["3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx"],
    size: "~25MB"
  }
};
var ModelManager = class {
  constructor(pluginDir) {
    this.modelsDir = path3.join(pluginDir, "models");
  }
  /** Check if a model is already downloaded */
  isDownloaded(key) {
    const model = MODELS[key];
    const modelDir = path3.join(this.modelsDir, key);
    return model.files.every((f) => fs.existsSync(path3.join(modelDir, f)));
  }
  /** Get the directory path for a model */
  getModelDir(key) {
    return path3.join(this.modelsDir, key);
  }
  /** Get the full path to a model file */
  getModelPath(key, filename) {
    return path3.join(this.modelsDir, key, filename);
  }
  /** Ensure a model is downloaded. Returns true if ready. */
  async ensureModel(key, onProgress) {
    if (this.isDownloaded(key)) {
      return true;
    }
    const model = MODELS[key];
    const modelDir = path3.join(this.modelsDir, key);
    try {
      fs.mkdirSync(modelDir, { recursive: true });
      onProgress?.(0, `${model.name} \uB2E4\uC6B4\uB85C\uB4DC \uC911 (${model.size})...`);
      new import_obsidian3.Notice(`${model.name} \uB2E4\uC6B4\uB85C\uB4DC \uC911... (${model.size})`);
      if (model.url.endsWith(".tar.bz2")) {
        await this.downloadAndExtract(model.url, modelDir, onProgress);
      } else {
        const filename = path3.basename(model.url);
        await this.downloadFile(model.url, path3.join(modelDir, filename), onProgress);
      }
      onProgress?.(100, `${model.name} \uB2E4\uC6B4\uB85C\uB4DC \uC644\uB8CC`);
      new import_obsidian3.Notice(`${model.name} \uB2E4\uC6B4\uB85C\uB4DC \uC644\uB8CC!`);
      return true;
    } catch (err) {
      console.error(`[ModelManager] Failed to download ${key}:`, err);
      new import_obsidian3.Notice(`\uBAA8\uB378 \uB2E4\uC6B4\uB85C\uB4DC \uC2E4\uD328: ${model.name}`);
      return false;
    }
  }
  /** Ensure all required models are downloaded */
  async ensureAllModels(onProgress) {
    const keys = ["whisper", "segmentation", "embedding"];
    let allOk = true;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const basePercent = i / keys.length * 100;
      const ok = await this.ensureModel(key, (p, msg) => {
        onProgress?.(basePercent + p / keys.length, msg);
      });
      if (!ok) allOk = false;
    }
    return allOk;
  }
  async downloadFile(url, destPath, onProgress) {
    const https = require("https");
    const http = require("http");
    return new Promise((resolve, reject) => {
      const client = url.startsWith("https") ? https : http;
      const doRequest = (requestUrl4) => {
        client.get(requestUrl4, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            doRequest(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
          let downloadedBytes = 0;
          const fileStream = fs.createWriteStream(destPath);
          res.on("data", (chunk) => {
            downloadedBytes += chunk.length;
            if (totalBytes > 0) {
              const percent = Math.round(downloadedBytes / totalBytes * 100);
              onProgress?.(percent, `\uB2E4\uC6B4\uB85C\uB4DC \uC911... ${Math.round(downloadedBytes / 1024 / 1024)}MB`);
            }
          });
          res.pipe(fileStream);
          fileStream.on("finish", () => {
            fileStream.close();
            resolve();
          });
          fileStream.on("error", reject);
        }).on("error", reject);
      };
      doRequest(url);
    });
  }
  async downloadAndExtract(url, destDir, onProgress) {
    const tmpPath = path3.join(destDir, "_download.tar.bz2");
    await this.downloadFile(url, tmpPath, onProgress);
    onProgress?.(90, "\uC555\uCD95 \uD574\uC81C \uC911...");
    const { execSync: execSync2 } = require("child_process");
    execSync2(`tar -xjf "${tmpPath}" -C "${destDir}" --strip-components=1`, {
      timeout: 6e4
    });
    fs.unlinkSync(tmpPath);
  }
};

// src/services/summarizer.ts
var import_child_process = require("child_process");
var MAX_TRANSCRIPT_CHARS = 5e4;
function buildPrompt(transcript, previousContext = "") {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const ctx = previousContext || "(\uC774\uC804 \uD68C\uC758 \uCEE8\uD14D\uC2A4\uD2B8 \uC5C6\uC74C)";
  return `\uB2F9\uC2E0\uC740 \uD68C\uC758\uB85D \uC694\uC57D \uC804\uBB38\uAC00\uC785\uB2C8\uB2E4. \uC544\uB798 \uD68C\uC758 \uB179\uCDE8\uB85D\uC744 \uBD84\uC11D\uD558\uC5EC \uD55C\uAD6D\uC5B4\uB85C \uAD6C\uC870\uD654\uB41C \uC694\uC57D\uC744 \uC791\uC131\uD574\uC8FC\uC138\uC694.

\uC624\uB298 \uB0A0\uC9DC: ${today}

## \uCD9C\uB825 \uD615\uC2DD (\uB9C8\uD06C\uB2E4\uC6B4)

### \uC694\uC57D
- (\uD575\uC2EC \uB17C\uC758\uC0AC\uD56D\uC744 3~5\uAC1C bullet point\uB85C)

### \uC8FC\uC694 \uACB0\uC815\uC0AC\uD56D
- (\uD68C\uC758\uC5D0\uC11C \uACB0\uC815\uB41C \uC0AC\uD56D\uB4E4)

### \uC561\uC158\uC544\uC774\uD15C
- [ ] \uD560\uC77C \uB0B4\uC6A9 \u{1F4C5} YYYY-MM-DD \u{1F464} \uB2F4\uB2F9\uC790\uC774\uB984

### \uD0DC\uADF8
#\uD0A4\uC6CC\uB4DC1 #\uD0A4\uC6CC\uB4DC2 #\uD0A4\uC6CC\uB4DC3

## \uADDC\uCE59
- \uB179\uCDE8\uB85D\uC5D0 \uBA85\uC2DC\uB41C \uB0B4\uC6A9\uB9CC \uC694\uC57D\uD558\uC138\uC694. \uCD94\uCE21\uD558\uC9C0 \uB9C8\uC138\uC694.
- \uD654\uC790 \uC774\uB984\uC740 \uB179\uCDE8\uB85D\uC5D0 \uB098\uC628 \uADF8\uB300\uB85C \uC0AC\uC6A9\uD558\uC138\uC694.
- \uC561\uC158\uC544\uC774\uD15C\uC774 \uC5C6\uC73C\uBA74 "\uC5C6\uC74C"\uC73C\uB85C \uD45C\uC2DC\uD558\uC138\uC694.
- \uC561\uC158\uC544\uC774\uD15C\uC758 \uAE30\uD55C\uC740 \uBC18\uB4DC\uC2DC YYYY-MM-DD \uD615\uC2DD\uC73C\uB85C \uC791\uC131\uD558\uC138\uC694.
- \uAE30\uD55C\uC774 \uBA85\uC2DC\uB418\uC9C0 \uC54A\uC740 \uC561\uC158\uC544\uC774\uD15C\uC740 \u{1F4C5} \uC5C6\uC774 \uC791\uC131\uD558\uC138\uC694.
- \uD0DC\uADF8\uB294 \uD68C\uC758\uC758 \uD575\uC2EC \uC8FC\uC81C/\uD504\uB85C\uC81D\uD2B8/\uAE30\uC220\uC744 3~7\uAC1C \uCD94\uCD9C\uD558\uC138\uC694.
- \uC774\uC804 \uD68C\uC758 \uCEE8\uD14D\uC2A4\uD2B8\uAC00 \uC81C\uACF5\uB418\uBA74, \uC774\uC804 \uC561\uC158\uC544\uC774\uD15C \uC911 \uC774\uBC88 \uD68C\uC758\uC5D0\uC11C \uC5B8\uAE09\uB41C \uAC83\uC758 \uB2EC\uC131 \uC5EC\uBD80\uB97C "### \uC774\uC804 \uC561\uC158\uC544\uC774\uD15C \uCD94\uC801" \uC139\uC158\uC5D0 \uD45C\uC2DC\uD558\uC138\uC694.
- \uC774\uC804 \uCEE8\uD14D\uC2A4\uD2B8\uAC00 \uC5C6\uC73C\uBA74 "### \uC774\uC804 \uC561\uC158\uC544\uC774\uD15C \uCD94\uC801" \uC139\uC158\uC744 \uC0DD\uB7B5\uD558\uC138\uC694.
- \uB9C8\uD06C\uB2E4\uC6B4 \uD615\uC2DD\uB9CC \uCD9C\uB825\uD558\uC138\uC694. \uB2E4\uB978 \uC124\uBA85\uC740 \uBD88\uD544\uC694\uD569\uB2C8\uB2E4.

## \uC774\uC804 \uD68C\uC758 \uCEE8\uD14D\uC2A4\uD2B8

${ctx}

## \uC774\uBC88 \uD68C\uC758 \uB179\uCDE8\uB85D

${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}`;
}
function formatTranscript(segments) {
  return segments.filter((s) => s.text.trim()).map((s) => `[${s.speaker}] ${s.text.trim()}`).join("\n");
}
function hasClaude() {
  try {
    (0, import_child_process.execSync)("which claude", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
function hasOllama() {
  try {
    (0, import_child_process.execSync)("ollama list", { stdio: "pipe", timeout: 5e3 });
    return true;
  } catch {
    return false;
  }
}
function summarize(segments, previousContext = "", timeout = 12e4) {
  const transcript = formatTranscript(segments);
  if (!transcript) return { summary: "", engine: "none", success: false };
  const prompt = buildPrompt(transcript, previousContext);
  if (hasClaude()) {
    try {
      const result = (0, import_child_process.execSync)(`claude -p "${prompt.replace(/"/g, '\\"')}"`, {
        timeout,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024
      }).trim();
      if (result) {
        return { summary: result, engine: "claude", success: true };
      }
    } catch (err) {
      console.warn("[Summarizer] Claude CLI failed:", err);
    }
  }
  if (hasOllama()) {
    try {
      const result = (0, import_child_process.execSync)(`ollama run llama3.1:8b "${prompt.replace(/"/g, '\\"')}"`, {
        timeout: timeout * 1.5,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024
      }).trim();
      if (result) {
        return { summary: result, engine: "ollama", success: true };
      }
    } catch (err) {
      console.warn("[Summarizer] Ollama failed:", err);
    }
  }
  return { summary: "", engine: "none", success: false };
}

// src/engine/index.ts
init_slack_sender();
var MeetNoteEngine = class {
  constructor(pluginDir, language = "ko") {
    this.callbacks = {};
    this.chunkSegments = [];
    this.initialized = false;
    this.modelManager = new ModelManager(pluginDir);
    this.transcriber = new Transcriber(this.modelManager, language);
    this.diarizer = new Diarizer(this.modelManager);
    this.recorder = new AudioRecorder(16e3, 30);
    this.language = language;
  }
  /** Initialize all models. Call once on plugin load. */
  async init(onProgress) {
    if (this.initialized) return;
    try {
      onProgress?.(0, "\uBAA8\uB378 \uD655\uC778 \uC911...");
      await this.transcriber.init((p, msg) => onProgress?.(p * 0.6, msg));
      await this.diarizer.init((p, msg) => onProgress?.(60 + p * 0.4, msg));
      this.initialized = true;
      onProgress?.(100, "\uC900\uBE44 \uC644\uB8CC");
    } catch (err) {
      throw new Error(`\uC5D4\uC9C4 \uCD08\uAE30\uD654 \uC2E4\uD328: ${err}`);
    }
  }
  get isInitialized() {
    return this.initialized;
  }
  get isRecording() {
    return this.recorder.isRecording;
  }
  setCallbacks(cbs) {
    this.callbacks = cbs;
  }
  /** Start recording from microphone. */
  async startRecording() {
    if (!this.initialized) throw new Error("\uC5D4\uC9C4\uC774 \uCD08\uAE30\uD654\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
    this.chunkSegments = [];
    await this.recorder.start((chunk) => {
      try {
        const segs = this.transcriber.transcribeBuffer(
          chunk.samples,
          chunk.sampleRate,
          this.chunkSegments.length > 0 ? this.chunkSegments[this.chunkSegments.length - 1].end : 0
        );
        this.chunkSegments.push(...segs);
        this.callbacks.onChunk?.(segs);
      } catch (err) {
        console.error("[Engine] Chunk transcription error:", err);
      }
    });
  }
  /** Stop recording and run full post-processing pipeline. */
  async stopRecording(previousContext = "", slackConfig) {
    const audio = this.recorder.stop();
    if (!audio) {
      this.callbacks.onError?.("\uC624\uB514\uC624\uAC00 \uCEA1\uCC98\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
      return;
    }
    try {
      this.callbacks.onProgress?.("transcription", 50);
      let transcriptionSegments = [...this.chunkSegments];
      if (transcriptionSegments.length === 0) {
        transcriptionSegments = this.transcriber.transcribeBuffer(
          audio.samples,
          audio.sampleRate
        );
      }
      this.callbacks.onProgress?.("transcription", 100);
      this.callbacks.onProgress?.("diarization", 55);
      let diarSegments = [];
      try {
        diarSegments = this.diarizer.run(audio.samples, audio.sampleRate);
      } catch (err) {
        console.warn("[Engine] Diarization failed:", err);
      }
      this.callbacks.onProgress?.("diarization", 85);
      const speakingStats = this.computeStats(diarSegments);
      this.callbacks.onProgress?.("merging", 90);
      const merged = this.merge(transcriptionSegments, diarSegments);
      this.callbacks.onProgress?.("summarizing", 92);
      let summaryText = "";
      try {
        const result = summarize(merged, previousContext);
        if (result.success) summaryText = result.summary;
      } catch (err) {
        console.warn("[Engine] Summary failed:", err);
      }
      let slackResult;
      if (slackConfig?.enabled) {
        this.callbacks.onProgress?.("slack_sending", 99);
        const startStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16).replace("T", " ");
        const speakerMap = {};
        merged.forEach((s) => {
          speakerMap[s.speaker] = s.speaker;
        });
        slackResult = await sendToSlack(
          slackConfig,
          merged,
          speakerMap,
          summaryText,
          speakingStats,
          startStr
        );
      }
      this.callbacks.onFinal?.(merged, summaryText, speakingStats, slackResult);
    } catch (err) {
      this.callbacks.onError?.(`\uCC98\uB9AC \uC624\uB958: ${err}`);
    }
  }
  merge(transcription, diarization) {
    if (diarization.length === 0) {
      return transcription.map((s) => ({
        timestamp: s.start,
        speaker: "UNKNOWN",
        text: s.text
      }));
    }
    const tSegs = [...transcription].sort((a, b) => a.start - b.start);
    const dSegs = [...diarization].sort((a, b) => a.start - b.start);
    const attributed = [];
    let unknownCounter = 0;
    for (const t of tSegs) {
      let bestSpeaker = "UNKNOWN";
      let bestOverlap = 0;
      for (const d of dSegs) {
        if (d.start >= t.end) break;
        const overlap = Math.max(0, Math.min(t.end, d.end) - Math.max(t.start, d.start));
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestSpeaker = d.speaker;
        }
      }
      let displayName = bestSpeaker;
      if (bestSpeaker.startsWith("SPEAKER_")) {
        const num = parseInt(bestSpeaker.replace("SPEAKER_", ""), 10) + 1;
        displayName = `\uD654\uC790${num}`;
      }
      attributed.push({ timestamp: t.start, speaker: displayName, text: t.text });
    }
    if (attributed.length <= 1) return attributed;
    const merged = [attributed[0]];
    for (let i = 1; i < attributed.length; i++) {
      const prev = merged[merged.length - 1];
      const curr = attributed[i];
      const gap = curr.timestamp - prev.timestamp;
      if (curr.speaker === prev.speaker && gap < 5) {
        merged[merged.length - 1] = {
          timestamp: prev.timestamp,
          speaker: prev.speaker,
          text: `${prev.text} ${curr.text}`
        };
      } else {
        merged.push(curr);
      }
    }
    return merged;
  }
  computeStats(segments) {
    if (segments.length === 0) return [];
    const durations = {};
    for (const seg of segments) {
      const speaker = seg.speaker.startsWith("SPEAKER_") ? `\uD654\uC790${parseInt(seg.speaker.replace("SPEAKER_", ""), 10) + 1}` : seg.speaker;
      durations[speaker] = (durations[speaker] || 0) + Math.max(0, seg.end - seg.start);
    }
    const total = Object.values(durations).reduce((a, b) => a + b, 0);
    if (total === 0) return [];
    return Object.entries(durations).map(([speaker, seconds]) => ({
      speaker,
      total_seconds: Math.round(seconds * 10) / 10,
      ratio: Math.round(seconds / total * 1e3) / 1e3
    })).sort((a, b) => b.total_seconds - a.total_seconds);
  }
  destroy() {
    if (this.recorder.isRecording) this.recorder.stop();
    this.transcriber.destroy();
    this.diarizer.destroy();
  }
};

// src/main.ts
var MeetNotePlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.isRecording = false;
    this.ribbonIconEl = null;
    this.recordingStartTime = null;
  }
  async onload() {
    await this.loadSettings();
    const pluginDir = this.app.vault.adapter.getBasePath() + "/.obsidian/plugins/meetnote";
    this.engine = new MeetNoteEngine(pluginDir, this.settings.language || "ko");
    this.writer = new MeetingWriter(this.app);
    this.statusBar = new RecorderStatusBar(this.addStatusBarItem());
    this.engine.setCallbacks({
      onChunk: (segments) => {
        this.writer.appendChunk(segments.map((s) => ({
          start: s.start,
          end: s.end,
          text: s.text
        })));
      },
      onProgress: (stage, percent) => {
        this.statusBar.setProgress(stage, percent);
      },
      onFinal: async (segments, summary, speakingStats, slackResult) => {
        if (!this.writer.currentFile) {
          const activeFile = this.app.workspace.getActiveFile();
          if (activeFile && activeFile.extension === "md") {
            await this.writer.init(activeFile, /* @__PURE__ */ new Date());
          }
        }
        const startTime = this.recordingStartTime ?? /* @__PURE__ */ new Date();
        const endTime = /* @__PURE__ */ new Date();
        const finalSegments = segments.map((s) => ({
          timestamp: s.timestamp,
          speaker: s.speaker,
          text: s.text
        }));
        await this.writer.writeFinal(
          finalSegments,
          startTime,
          endTime,
          summary,
          speakingStats.map((s) => ({
            speaker: s.speaker,
            total_seconds: s.total_seconds,
            ratio: s.ratio
          }))
        );
        if (this.settings.autoLinkEnabled && this.writer.tags.length > 0) {
          try {
            const linked = await this.writer.linkRelatedMeetings();
            if (linked > 0) {
              new import_obsidian4.Notice(`${linked}\uAC1C \uC5F0\uAD00 \uD68C\uC758\uB97C \uB9C1\uD06C\uD588\uC2B5\uB2C8\uB2E4.`);
            }
          } catch (err) {
            console.error("[MeetNote] \uC5F0\uAD00 \uD68C\uC758 \uB9C1\uD06C \uC2E4\uD328:", err);
          }
        }
        this.statusBar.setIdle();
        this.isRecording = false;
        this.updateRibbonIcon();
        this.writer.reset();
        this.recordingStartTime = null;
        new import_obsidian4.Notice("\uD68C\uC758\uB85D \uC791\uC131\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
        if (slackResult) {
          if (slackResult.success) {
            new import_obsidian4.Notice("\uD68C\uC758\uB85D\uC774 Slack\uC5D0 \uC804\uC1A1\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
          } else if (slackResult.error) {
            new import_obsidian4.Notice(`Slack \uC804\uC1A1 \uC2E4\uD328: ${slackResult.error}`);
          }
        }
      },
      onError: (message) => {
        new import_obsidian4.Notice(`MeetNote \uC624\uB958: ${message}`);
        console.error("[MeetNote]", message);
      }
    });
    try {
      await this.engine.init((percent, msg) => {
        this.statusBar.setProgress("initializing", percent);
        if (percent === 100) this.statusBar.setIdle();
      });
      console.log("[MeetNote] Engine initialized");
    } catch (err) {
      console.error("[MeetNote] Engine init failed:", err);
      new import_obsidian4.Notice(`MeetNote \uCD08\uAE30\uD654 \uC2E4\uD328: ${err}`);
    }
    this.ribbonIconEl = this.addRibbonIcon(
      "mic",
      "MeetNote",
      () => {
        if (this.isRecording) {
          this.stopRecording();
        } else {
          this.startRecording();
        }
      }
    );
    this.addCommand({
      id: "start-recording",
      name: "\uB179\uC74C \uC2DC\uC791",
      callback: () => this.startRecording()
    });
    this.addCommand({
      id: "stop-recording",
      name: "\uB179\uC74C \uC911\uC9C0",
      callback: () => this.stopRecording()
    });
    this.addCommand({
      id: "search-meetings",
      name: "\uACFC\uAC70 \uD68C\uC758 \uAC80\uC0C9",
      callback: () => this.searchMeetings()
    });
    this.addCommand({
      id: "meeting-dashboard",
      name: "\uD68C\uC758 \uD2B8\uB80C\uB4DC \uB300\uC2DC\uBCF4\uB4DC",
      callback: () => this.generateDashboard()
    });
    this.addSettingTab(new MeetNoteSettingTab(this.app, this));
    console.log("MeetNote plugin loaded (Phase 2 \u2014 standalone)");
  }
  async onunload() {
    if (this.isRecording) {
      this.stopRecording();
    }
    this.engine.destroy();
    this.statusBar.destroy();
    console.log("MeetNote plugin unloaded");
  }
  async startRecording() {
    if (this.isRecording) {
      new import_obsidian4.Notice("\uC774\uBBF8 \uB179\uC74C \uC911\uC785\uB2C8\uB2E4.");
      return;
    }
    if (!this.engine.isInitialized) {
      new import_obsidian4.Notice("\uC5D4\uC9C4\uC774 \uC544\uC9C1 \uCD08\uAE30\uD654 \uC911\uC785\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.");
      return;
    }
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension !== "md") {
      new import_obsidian4.Notice("\uD68C\uC758\uB85D\uC744 \uC791\uC131\uD560 \uB9C8\uD06C\uB2E4\uC6B4 \uBB38\uC11C\uB97C \uBA3C\uC800 \uC5F4\uC5B4\uC8FC\uC138\uC694.");
      return;
    }
    this.isRecording = true;
    this.recordingStartTime = /* @__PURE__ */ new Date();
    this.updateRibbonIcon();
    await this.writer.init(activeFile, this.recordingStartTime);
    this.statusBar.startRecording();
    try {
      await this.engine.startRecording();
      new import_obsidian4.Notice("\uB179\uC74C\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4.");
    } catch (err) {
      this.isRecording = false;
      this.updateRibbonIcon();
      new import_obsidian4.Notice(`\uB179\uC74C \uC2DC\uC791 \uC2E4\uD328: ${err}`);
    }
  }
  async stopRecording() {
    if (!this.isRecording) {
      new import_obsidian4.Notice("\uD604\uC7AC \uB179\uC74C \uC911\uC774 \uC544\uB2D9\uB2C8\uB2E4.");
      return;
    }
    this.statusBar.stopRecording();
    this.statusBar.setProgress("\uD654\uC790 \uAD6C\uBD84", 0);
    new import_obsidian4.Notice("\uB179\uC74C\uC744 \uC911\uC9C0\uD569\uB2C8\uB2E4. \uCC98\uB9AC \uC911...");
    const previousContext = await this.loadPreviousMeetingContext();
    const slackConfig = this.settings.slackEnabled ? { enabled: true, webhookUrl: this.settings.slackWebhookUrl } : void 0;
    await this.engine.stopRecording(previousContext, slackConfig);
  }
  async generateDashboard() {
    const mdFiles = this.app.vault.getMarkdownFiles();
    const meetings = [];
    for (const file of mdFiles) {
      const content = await this.app.vault.cachedRead(file);
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;
      const fm = fmMatch[1];
      const dateMatch = fm.match(/^date:\s*(.+)$/m);
      if (!dateMatch) continue;
      const tags = [];
      const tagLines = fm.match(/tags:\n((?:\s+-\s+.+\n?)*)/);
      if (tagLines) {
        for (const m of tagLines[1].matchAll(/\s+-\s+(.+)/g)) tags.push(m[1].trim());
      }
      const participants = [];
      const partLines = fm.match(/participants:\n((?:\s+-\s+.+\n?)*)/);
      if (partLines) {
        for (const m of partLines[1].matchAll(/\s+-\s+(.+)/g)) participants.push(m[1].trim());
      }
      const decisions = (content.match(/### 주요 결정사항\n([\s\S]*?)(?=\n### |$)/)?.[1] || "").split("\n").filter((l) => l.startsWith("- ")).length;
      const actionMatch = content.match(/### 액션아이템\n([\s\S]*?)(?=\n### |$)/)?.[1] || "";
      const actionItems = (actionMatch.match(/- \[[ x]\]/g) || []).length;
      const completedActions = (actionMatch.match(/- \[x\]/g) || []).length;
      const durationMatch = content.match(/녹음: (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) ~ (\d{2}:\d{2})/);
      let durationMinutes = 0;
      if (durationMatch) {
        const [, , startStr, endStr] = durationMatch;
        const [sh, sm] = startStr.split(":").map(Number);
        const [eh, em] = endStr.split(":").map(Number);
        durationMinutes = eh * 60 + em - (sh * 60 + sm);
        if (durationMinutes < 0) durationMinutes += 24 * 60;
      }
      meetings.push({
        filename: file.basename,
        date: dateMatch[1].trim(),
        tags,
        participants,
        decisions,
        actionItems,
        completedActions,
        durationMinutes
      });
    }
    if (meetings.length === 0) {
      new import_obsidian4.Notice("\uBD84\uC11D\uD560 \uD68C\uC758\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    meetings.sort((a, b) => a.date.localeCompare(b.date));
    const totalMeetings = meetings.length;
    const totalMinutes = meetings.reduce((s, m) => s + m.durationMinutes, 0);
    const totalDecisions = meetings.reduce((s, m) => s + m.decisions, 0);
    const totalActions = meetings.reduce((s, m) => s + m.actionItems, 0);
    const totalCompleted = meetings.reduce((s, m) => s + m.completedActions, 0);
    const participantCount = {};
    for (const m of meetings) for (const p of m.participants) participantCount[p] = (participantCount[p] || 0) + 1;
    const topParticipants = Object.entries(participantCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const tagCount = {};
    for (const m of meetings) for (const t of m.tags) {
      if (t !== "\uD68C\uC758") tagCount[t] = (tagCount[t] || 0) + 1;
    }
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const monthly = {};
    for (const m of meetings) {
      const month = m.date.slice(0, 7);
      if (!monthly[month]) monthly[month] = { count: 0, minutes: 0, decisions: 0 };
      monthly[month].count++;
      monthly[month].minutes += m.durationMinutes;
      monthly[month].decisions += m.decisions;
    }
    const avgEfficiency = totalMinutes > 0 ? (totalDecisions / totalMinutes * 60).toFixed(1) : "N/A";
    const bar = (ratio, w = 15) => "\u2588".repeat(Math.round(ratio * w)) + "\u2591".repeat(w - Math.round(ratio * w));
    const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16).replace("T", " ");
    const lines = [
      "# \uD68C\uC758 \uD2B8\uB80C\uB4DC \uB300\uC2DC\uBCF4\uB4DC",
      `> \uC0DD\uC131: ${now} | \uBD84\uC11D \uB300\uC0C1: ${totalMeetings}\uAC1C \uD68C\uC758`,
      "",
      "## \uC804\uCCB4 \uC694\uC57D",
      "",
      "| \uC9C0\uD45C | \uAC12 |",
      "|------|------|",
      `| \uCD1D \uD68C\uC758 \uC218 | ${totalMeetings}\uD68C |`,
      `| \uCD1D \uD68C\uC758 \uC2DC\uAC04 | ${Math.floor(totalMinutes / 60)}\uC2DC\uAC04 ${totalMinutes % 60}\uBD84 |`,
      `| \uD3C9\uADE0 \uD68C\uC758 \uC2DC\uAC04 | ${totalMeetings > 0 ? Math.round(totalMinutes / totalMeetings) : 0}\uBD84 |`,
      `| \uCD1D \uACB0\uC815\uC0AC\uD56D | ${totalDecisions}\uAC74 |`,
      `| \uCD1D \uC561\uC158\uC544\uC774\uD15C | ${totalActions}\uAC74 (\uC644\uB8CC: ${totalCompleted}\uAC74, ${totalActions > 0 ? Math.round(totalCompleted / totalActions * 100) : 0}%) |`,
      `| \uD6A8\uC728\uC131 (\uACB0\uC815/\uC2DC\uAC04) | ${avgEfficiency}\uAC74/\uC2DC\uAC04 |`,
      "",
      "## \uC6D4\uBCC4 \uCD94\uC774",
      "",
      "| \uC6D4 | \uD68C\uC758 \uC218 | \uCD1D \uC2DC\uAC04 | \uACB0\uC815\uC0AC\uD56D |",
      "|------|---------|---------|----------|"
    ];
    for (const [month, data] of Object.entries(monthly).sort()) lines.push(`| ${month} | ${data.count}\uD68C | ${data.minutes}\uBD84 | ${data.decisions}\uAC74 |`);
    lines.push("", "## \uC8FC\uC694 \uC8FC\uC81C (\uD0DC\uADF8 \uBE48\uB3C4)", "");
    if (topTags.length > 0) {
      const max = topTags[0][1];
      for (const [tag, count] of topTags) lines.push(`- \`${bar(count / max)}\` #${tag} (${count}\uD68C)`);
    }
    lines.push("", "## \uCC38\uC11D\uC790 \uBE48\uB3C4", "");
    if (topParticipants.length > 0) {
      const max = topParticipants[0][1];
      for (const [name, count] of topParticipants) lines.push(`- \`${bar(count / max)}\` ${name} (${count}\uD68C)`);
    }
    lines.push("", "## \uCD5C\uADFC \uD68C\uC758 \uBAA9\uB85D", "", "| \uB0A0\uC9DC | \uD68C\uC758 | \uC2DC\uAC04 | \uACB0\uC815 | \uC561\uC158 |", "|------|------|------|------|------|");
    for (const m of meetings.slice(-20).reverse()) lines.push(`| ${m.date} | [[${m.filename}]] | ${m.durationMinutes}\uBD84 | ${m.decisions}\uAC74 | ${m.actionItems}\uAC74 |`);
    const dashboardContent = lines.join("\n");
    const dashboardPath = "MeetNote Dashboard.md";
    const existingFile = this.app.vault.getAbstractFileByPath(dashboardPath);
    if (existingFile instanceof import_obsidian4.TFile) {
      await this.app.vault.modify(existingFile, dashboardContent);
    } else {
      await this.app.vault.create(dashboardPath, dashboardContent);
    }
    const dashFile = this.app.vault.getAbstractFileByPath(dashboardPath);
    if (dashFile instanceof import_obsidian4.TFile) await this.app.workspace.getLeaf().openFile(dashFile);
    new import_obsidian4.Notice(`\uD68C\uC758 \uB300\uC2DC\uBCF4\uB4DC\uAC00 \uC0DD\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (${totalMeetings}\uAC1C \uD68C\uC758 \uBD84\uC11D)`);
  }
  async searchMeetings() {
    const mdFiles = this.app.vault.getMarkdownFiles();
    const meetings = {};
    for (const file of mdFiles) {
      const content = await this.app.vault.cachedRead(file);
      if (content.includes("<!-- meetnote-start -->") || content.match(/^---\n[\s\S]*?tags:[\s\S]*?회의/m)) {
        meetings[file.basename] = content;
      }
    }
    if (Object.keys(meetings).length === 0) {
      new import_obsidian4.Notice("\uAC80\uC0C9\uD560 \uD68C\uC758\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    const question = await this.promptUser("\uACFC\uAC70 \uD68C\uC758 \uAC80\uC0C9", "\uC9C8\uBB38\uC744 \uC785\uB825\uD558\uC138\uC694");
    if (!question) return;
    new import_obsidian4.Notice("\uAC80\uC0C9 \uC911...");
    const results = [];
    const queryWords = question.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    for (const [name, content] of Object.entries(meetings)) {
      const lower = content.toLowerCase();
      let score = 0;
      for (const word of queryWords) {
        const count = (lower.match(new RegExp(word, "g")) || []).length;
        score += count;
      }
      if (score > 0) {
        const snippet = content.slice(0, 200).replace(/\n/g, " ");
        results.push({ name, score, snippet });
      }
    }
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, 5);
    if (topResults.length === 0) {
      new import_obsidian4.Notice("\uAD00\uB828 \uD68C\uC758\uB85D\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      return;
    }
    let answer = "";
    try {
      const { execSync: execSync2 } = require("child_process");
      const context = topResults.map((r) => `--- ${r.name} ---
${meetings[r.name]?.slice(0, 3e3)}`).join("\n\n");
      const prompt = `\uB2E4\uC74C \uD68C\uC758\uB85D\uC5D0\uC11C \uC9C8\uBB38\uC5D0 \uB2F5\uBCC0\uD574\uC8FC\uC138\uC694.

${context}

\uC9C8\uBB38: ${question}

\uD68C\uC758\uB85D\uC5D0 \uADFC\uAC70\uD558\uC5EC \uB2F5\uBCC0\uD558\uC138\uC694.`;
      if (require("child_process").execSync("which claude", { stdio: "pipe" }).toString().trim()) {
        answer = execSync2(`claude -p "${prompt.replace(/"/g, '\\"')}"`, { timeout: 6e4, encoding: "utf-8" }).trim();
      }
    } catch {
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16).replace("T", " ");
    const sources = topResults.map((r) => `- [[${r.name}]] (\uAD00\uB828\uB3C4: ${r.score})`).join("\n");
    const answerContent = [
      "# \uD68C\uC758 \uAC80\uC0C9 \uACB0\uACFC",
      `> \uC9C8\uBB38: ${question}`,
      `> \uAC80\uC0C9 \uC2DC\uAC04: ${timestamp}`,
      "",
      answer ? `## \uB2F5\uBCC0
${answer}
` : "",
      "## \uCD9C\uCC98",
      sources
    ].join("\n");
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      await this.app.vault.process(activeFile, (content) => content + "\n\n" + answerContent);
    }
    new import_obsidian4.Notice("\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uBB38\uC11C\uC5D0 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
  }
  promptUser(title, placeholder) {
    return new Promise((resolve) => {
      const modal = new class extends require("obsidian").Modal {
        constructor() {
          super(...arguments);
          this.result = null;
        }
        onOpen() {
          const { contentEl } = this;
          contentEl.createEl("h3", { text: title });
          const input = contentEl.createEl("input", { type: "text", placeholder });
          input.style.width = "100%";
          input.style.marginBottom = "10px";
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              this.result = input.value;
              this.close();
            }
          });
          const btn = contentEl.createEl("button", { text: "\uAC80\uC0C9" });
          btn.addEventListener("click", () => {
            this.result = input.value;
            this.close();
          });
          input.focus();
        }
        onClose() {
          resolve(this.result);
        }
      }(this.app);
      modal.open();
    });
  }
  async loadPreviousMeetingContext() {
    try {
      const mdFiles = this.app.vault.getMarkdownFiles();
      const meetingFiles = [];
      for (const file of mdFiles) {
        if (file.path === this.app.workspace.getActiveFile()?.path) continue;
        const content2 = await this.app.vault.cachedRead(file);
        const fmMatch = content2.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) continue;
        const dateMatch = fmMatch[1].match(/^date:\s*(.+)$/m);
        if (dateMatch) meetingFiles.push({ file, date: dateMatch[1].trim() });
      }
      if (meetingFiles.length === 0) return "";
      meetingFiles.sort((a, b) => b.date.localeCompare(a.date));
      const latest = meetingFiles[0];
      const content = await this.app.vault.cachedRead(latest.file);
      const parts = [];
      const summaryMatch = content.match(/### 요약\n([\s\S]*?)(?=\n### |$)/);
      if (summaryMatch) parts.push("### \uC774\uC804 \uD68C\uC758 \uC694\uC57D\n" + summaryMatch[1].trim());
      const actionMatch = content.match(/### 액션아이템\n([\s\S]*?)(?=\n### |$)/);
      if (actionMatch) parts.push("### \uC774\uC804 \uC561\uC158\uC544\uC774\uD15C\n" + actionMatch[1].trim());
      if (parts.length === 0) return "";
      return `(${latest.date} \uD68C\uC758 \u2014 ${latest.file.basename})

` + parts.join("\n\n");
    } catch {
      return "";
    }
  }
  updateRibbonIcon() {
    if (!this.ribbonIconEl) return;
    if (this.isRecording) {
      this.ribbonIconEl.ariaLabel = "\uB179\uC74C \uC911\uC9C0";
      (0, import_obsidian4.setIcon)(this.ribbonIconEl, "square");
    } else {
      this.ribbonIconEl.ariaLabel = "MeetNote";
      (0, import_obsidian4.setIcon)(this.ribbonIconEl, "mic");
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
