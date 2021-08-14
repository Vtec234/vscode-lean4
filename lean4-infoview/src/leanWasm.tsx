import * as React from "react";
import * as ReactDOM from "react-dom";

interface LeanEmscriptenModule extends EmscriptenModule {
  cwrap: typeof cwrap;
  ccall: typeof ccall;
}
declare const createLeanModule: EmscriptenModuleFactory<LeanEmscriptenModule>;

// This is the Infoview for a particular file.
// It encapsulates a WebAssembly.memory object containing the client-side state for this file.
class InfoviewForFile extends React.Component {}

// Can we have an async header parser and olean loader? I guess so..

// Big Q: should the client-side run on main thread (direct DOM access) or in a worker (dom access through messages)
// Maybe we just give the worker the ability to set the props of a top-level React component and call it a day?
// But ideally we want the client-side to be able to instantiate arbitrary hierarchies (and also to not use React)

  declare function postMessage(ev: any): void;
  declare function importScripts(...urls: string[]): void;

function workerFn() {
  postMessage("Worker starting.")

  // Sync XHR is not intercepted by ServiceWorkers in Chrome, so we *cannot do it*
  // to retrieve local resources
  // https://github.com/microsoft/vscode/issues/125802
  //const xhr = new XMLHttpRequest();
  //xhr.open("HEAD", "${jsPath}", false);
  //xhr.send();
  //outputLog("--- XHR ${jsPath}");
  //if (xhr.status !== 200) { outputLog("FAIL"); } else { outputLog("GOOD"); }

  var timer = 0;
  function startTimer(): void {
    timer = Date.now();
  }
  function checkTimer(): string {
    return `Took ${Date.now() - timer} ms.`;
  }
  function withTimer(msg: string, func: () => void) {
    postMessage(msg); startTimer();
    func();
    postMessage(checkTimer());
  }

  onmessage = (ev) => {
    const dat = ev.data as LeanLoaderProps;

    postMessage(`self.location.href= ${self.location.href}`);
    withTimer('--- Loading Emscripten...', () => {
      importScripts(dat.leanJsPath);
    });
    postMessage('--- Compiling Lean WASM...'); startTimer();
    const runner = createLeanModule({
      noExitRuntime: true,
      print: (m: string) => postMessage(m),
      printErr: (m: string) => postMessage("[STDERR] " + m),
      locateFile: (path: string, prefix: string) => {
        postMessage('Trying to locate prefix=' + prefix + ' path=' + path);
        if (path === "leanWasm.wasm") {
          const path = dat.leanJsPath.slice(0, -3) + ".wasm";
          postMessage("Redir to " + path);
          return path;
        }
        return prefix + path; 
      }
    }).then((Module) => {
      postMessage(checkTimer());

      withTimer("--- Calling lean_wasm_initialize()...", () => {
        Module.ccall('lean_wasm_initialize', null, ['string'], [dat.leanLibPath]);
      });
     //withTimer("--- Running test...", () => {
     //  Module.ccall('lean_wasm_testStuff', null, [], []);
     //});
     //withTimer("--- Running import Init...", () => {
     //  Module.ccall('lean_wasm_import', null, ['string'], ['import Init\\n']);
     //});
     //withTimer("--- Running import Std...", () => {
     //  Module.ccall('lean_wasm_import', null, ['string'], ['import Std\\n']);
     //});
      withTimer("--- Running import Lean...", () => {
        Module.ccall('lean_wasm_import', null, ['string'], ['import Lean\\n']);
      });
      withTimer("--- Finalizing...", () => {
        Module.ccall('lean_wasm_finalize', null, ['string'], ['import Lean\\n']);
      });

      //How does the blob know which client-side code to execute?
      //1. needs to load .olean with widget client-side
      //2. needs to call something in the .olean
      //These will probably have to be posted as a msg from TypeScript
    });
  }
}

function fn2workerURL(fn: any): string {
  const blob = new Blob(['('+fn.toString()+')()'], {type: 'text/javascript'});
  return URL.createObjectURL(blob);
}

interface LeanLoaderProps {
  leanLibPath: string;
  leanJsPath: string;
}

export class LeanLoader extends React.Component<LeanLoaderProps, {log: string[]}> {
  myTimer : number;
  myRunner: any;

  constructor(props: LeanLoaderProps) {
    super(props);
    this.state = { log: [] };
    this.myTimer = 0;
  }

  startLeanWorker() {
    if (window.Worker) {
      let url = fn2workerURL(workerFn);
      this.outputLog("[*] Starting worker at", url);
      let wrk = new Worker(url);
      wrk.onmessage = (ev) => {
        this.outputLog("[worker]", ev.data as string);
      }
      wrk.postMessage(this.props);
    }
  }

  componentDidMount() {
    this.startLeanWorker();
  }

  outputLog(...msg: any[]) {
    console.log(...msg);
    const fmt = msg.reduce((previous, current) => {
        return previous.toString() + " " + current.toString(); },
      "");
    this.setState((state) => {
      return { log: state.log.concat([fmt]) } });
  }

  startTimer() {
    this.myTimer = Date.now();
  }

  checkTimer(): string {
    return `Took ${Date.now() - this.myTimer} ms.`;
  }

  withTimer(msg: string, func: () => void) {
    this.outputLog(msg); this.startTimer();
    func();
    this.outputLog(this.checkTimer());
  }

  // Loads the module at the given URI into the WASM blob's memory
  async loadModule(uri: string) {

  }

  render() {
    const log = this.state.log.reduce((acc, val) => acc + val + "\n", "");
    return (
      <pre id="lean-client-out">{log}</pre>
    );
  }
}

export interface LeanClientConfig {
  leanLibPath : string;
  leanJsPath : string;
}

export default function(conf: LeanClientConfig, uiElement: HTMLElement) {
  // display "Loading .."
  // fetch infoview from .. where?
  // TODO make this file a plain .ts and call out to another .tsx module
  ReactDOM.render(
    <React.StrictMode>
      // TODO: how to make this a config obj rather than a prop?
      <LeanLoader leanLibPath={conf.leanLibPath} leanJsPath={conf.leanJsPath} />
    </React.StrictMode>,
    uiElement);
}