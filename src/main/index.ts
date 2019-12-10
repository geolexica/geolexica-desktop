// Jury-rig globa.fetch to make Isomorphic Git work under Node
import fetch from 'node-fetch';
(global as any).fetch = fetch;

import * as fs from 'fs-extra';
import * as path from 'path';

import { app, ipcMain } from 'electron';
import * as log from 'electron-log';

import { WindowOpenerParams, openWindow, windows, notifyAllWindows } from 'sse/main/window';
import { listen, makeWindowEndpoint } from 'sse/api/main';
import { SettingManager } from 'sse/settings/main';
import { initRepo } from 'sse/storage/main/git/controller';

import {
  provideOne,
  provideAll,
  provideModified,
  listenToBatchCommits,
  listenToBatchDiscardRequests,
} from 'sse/storage/main/api';

import { Concept } from 'models/concept';

import { getStorage, MainStorage } from 'storage/main';


// Ensure only one instance of the app can run at a time on given user’s machine
if (!app.requestSingleInstanceLock()) { app.exit(0); }

// Disable GPU (?)
app.disableHardwareAcceleration();

// Catch unhandled errors in electron-log
log.catchErrors({ showDialog: true });


// Proceed with app launch sequence

const isMacOS = process.platform === 'darwin';
const isDevelopment = process.env.NODE_ENV !== 'production';


const APP_TITLE = "ISO/TC 211";

let APP_HELP_ROOT: string;
if (!isDevelopment) {
  APP_HELP_ROOT = "https://geolexica.org/desktop/help/";
} else {
  APP_HELP_ROOT = "http://geolexica.org:4000/desktop/help/";
}


// All app-specific data
const APP_DATA = app.getPath('userData');

// Git repository contents—our database
const WORK_DIR = path.join(APP_DATA, 'geolexica-database');

const UPSTREAM_REPO_URL = 'https://github.com/ISO-TC211/geolexica-database';
const CORS_PROXY_URL = 'https://cors.isomorphic-git.org';


const CONFIG_WINDOW_OPTS: WindowOpenerParams = {
  component: 'dataSynchronizer',
  title: 'Settings',
  componentParams: `defaultRepoUrl=${UPSTREAM_REPO_URL || ''}`,
  dimensions: { width: 800, minWidth: 600, maxWidth: 1000, height: 450, minHeight: 400, maxHeight: 400 },
};

const HOME_WINDOW_OPTS: WindowOpenerParams = {
  component: 'home',
  title: 'ISO/TC 211 Geolexica Desktop',
  frameless: true,
  dimensions: { width: 800, height: 500, minWidth: 800, minHeight: 500 },
};

const HELP_WINDOW_OPTS: WindowOpenerParams = {
  title: `${APP_TITLE} Help`,
  url: APP_HELP_ROOT,
  dimensions: { width: 1100, height: 850, minWidth: 550, minHeight: 450 },
}


/* On macOS, it is common to not quit when all windows are closed,
   and recreate main window after app is activated. */

function maybeOpenHome() {
  if (app.isReady()) {
    if (windows.length < 1) {
      log.verbose("Opening home screen (no windows open yet)");
      openHomeWindow();
    }
  }
}

function maybeQuit() {
  if (!isMacOS) {
    log.verbose("Quitting (not macOS)");
    app.quit();
  }
}

function cleanUpListeners() {
  log.verbose("Cleaning up app event listeners");
  app.removeListener('activate', maybeOpenHome);
  app.removeListener('window-all-closed', maybeQuit);
  app.removeListener('quit', cleanUpListeners);
}

app.on('activate', maybeOpenHome);
app.on('window-all-closed', maybeQuit);
app.on('quit', cleanUpListeners);


const SETTINGS_PATH = path.join(APP_DATA, 'isotc211-geolexica-settings.yaml');
const settings = new SettingManager(SETTINGS_PATH);
settings.setUpAPIEndpoints();


app.whenReady().

then(() => {
  // Stage 1: Set up main settings screen,
  // and request from the user to configure repository URL if needed
  log.verbose("App launch: stage 1");

  ipcMain.on('clear-app-data', async (event: any) => {
    log.warn("App: Clearing app data!");

    log.debug(`App: Deleting ${APP_DATA}`);
    await fs.remove(APP_DATA);

    log.debug("App: Setting relaunch flag");
    app.relaunch();

    log.debug("App: Quitting");
    app.quit();
  });

  ipcMain.on('launch-devtools', async (event: any) => {
    log.info("App: received launch-devtools request");

    for (const window of windows) {
      if (window !== null) {
        window.webContents.openDevTools();
      }
    }
  });

  makeWindowEndpoint('settings', () => CONFIG_WINDOW_OPTS);

  return initRepo(
    WORK_DIR,
    UPSTREAM_REPO_URL,
    CORS_PROXY_URL,
    false,
    settings, {
      ...CONFIG_WINDOW_OPTS,
      componentParams: `${CONFIG_WINDOW_OPTS.componentParams}&inPreLaunchSetup=1`,
    },
  );
}).

then(async (gitCtrl) => {
  // Stage 2: Set up API endpoints and notify main app screen that launch was successful
  log.verbose("App launch: stage 2");

  await openHomeWindow();

  const storage: MainStorage = getStorage(gitCtrl);

  //if (isMacOS) {
  //  // Set up app menu
  //  Menu.setApplicationMenu(buildAppMenu({
  //    getFileMenuItems: () => ([
  //      {
  //        label: "Open main window",
  //        click: async () => await openWindow(HOME_WINDOW_OPTS),
  //      },
  //    ]),
  //    getHelpMenuItems: () => ([
  //      {
  //        label: "How to use ITU OB Editor?",
  //        click: async () => { await openHelpWindow() },
  //      },
  //      {
  //        label: "Data migration guide",
  //        click: async () => { await openHelpWindow('migration/', { title: "Data migration guide" }) },
  //      },
  //    ]),
  //  }));
  //} else {
  //  Menu.setApplicationMenu(null);
  //}


  /* Set up endpoints */

  // TODO: Implement time travel (undo/redo) via main API endpoints.
  // Store whole workspace in one timeline, or have per-index / per-object timelines
  // and reconcile them somehow;
  // possibly record timeline states into a temporary file;
  // allow dispatching reducer actions through API endpoints (including types UNDO/REDO).

  gitCtrl.setUpAPIEndpoints();


  // When we hear any of these events, sync remote storage.
  // In addition to that, it will also get called in object update handlers below.
  ipcMain.on('remote-storage-trigger-sync', gitCtrl.synchronize);
  ipcMain.on('remote-storage-discard-all', () => gitCtrl.resetFiles());
  ipcMain.on('remote-storage-trigger-uncommitted-check', gitCtrl.checkUncommitted);
  ipcMain.on('concepts-changed', async () => await notifyAllWindows('concepts-changed'));


  /* Storage endpoints */

  provideAll(storage, 'concepts');
  provideOne(storage, 'concepts');
  provideModified(storage, 'concepts');
  listenToBatchCommits(storage, 'concepts');
  listenToBatchDiscardRequests(storage, 'concepts');


  /* Concept editor */

  listen<{ id: number }, Concept>
  ('concept', async ({ id }) => {
    const concept: Concept = await storage.concepts.read(id);
    return concept;
  });

  listen<{ id: number, data: Concept, commit: boolean }, { modified: boolean }>
  ('concept-update', async ({ id, data, commit }) => {
    await storage.concepts.update(id, data, commit);
    if (!commit) {
      return { modified: (await storage.concepts.listUncommitted()).indexOf(id) >= 0 };
    } else {
      return { modified: false };
    }
  });

  listen<{ query?: string}, { items: Concept[], total: number }>('search-concepts', async ({ query }) => {
    const items = Object.values(await storage.concepts.findAll(query));
    return {
      items: items.slice(0, 20),
      total: items.length,
    };
  });


  /* Set up window-opening endpoints */

  makeWindowEndpoint('concept', ({ id, lang }: { id: string, lang?: string }) => ({
    component: 'concept',
    title: `Concept ${id}`,
    componentParams: `id=${id}&lang=${lang || ''}`,
    frameless: true,
    dimensions: { width: 800, height: 600, minWidth: 700, minHeight: 500 },
  }));

  makeWindowEndpoint('batch-commit', () => ({
    component: 'batchCommit',
    title: 'Commit or discard changes',
    frameless: true,
    dimensions: { width: 700, height: 500 },
  }));

  makeWindowEndpoint('help', ({ path, title }: { path?: string, title?: string }) => ({
    ...HELP_WINDOW_OPTS,
    ...(title ? { title } : {}),
    url: `${APP_HELP_ROOT}${path || ''}`,
  }));


  log.verbose("Message home screen that app has loaded");
  await notifyAllWindows('app-loaded');

});


async function openHomeWindow() {
  return await openWindow(HOME_WINDOW_OPTS);
}


//async function openHelpWindow(path?: string, opts?: any) {
//  return await openWindow({
//    ...HELP_WINDOW_OPTS,
//    ...(opts ? opts : {}),
//    ...(path ? { url: `${APP_HELP_ROOT}${path || ''}` } : {}),
//  });
//}
