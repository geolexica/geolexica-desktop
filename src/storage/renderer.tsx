import { ipcRenderer } from 'electron';

import React, { useState, useEffect, useContext } from 'react';

import { RendererStorage as BaseRendererStorage, ModifiedObjectStatus, StorageContextSpec } from 'sse/storage/renderer';
import { RemoteStorageStatus } from 'sse/storage/main/remote';
import { request } from 'sse/api/renderer';
import { Index } from 'sse/storage/query';

import { Concept } from 'models/concept';

import { Storage } from '.';


export type RendererStorage = BaseRendererStorage<Storage>;


/* Context-consuming hooks */

export function useStorage(): RendererStorage {
  const storage = useContext(StorageContext);
  return storage.current;
}


export function useModified(): ModifiedObjectStatus<RendererStorage> {
  const storage = useContext(StorageContext);
  return storage.modified;
}


export function useConcept(id: string | undefined): Concept | undefined {
  if (!id) { return; }

  const storage = useStorage();
  return storage.concepts[id];
}


/* Context provider */

export const StorageContextProvider: React.FC<{}> = function ({ children }) {

  const initStorage: StorageContextSpec<RendererStorage> = {
    current: {
      concepts: {},
    },
    modified: {
      concepts: [],
    },
    refresh: async () => {
      const results = await Promise.all([
        await request<Index<Concept>>('storage-read-all-concepts'),
      ]);
      const newCurrent = {
        concepts: results[0],
      };
      updateStorage(storage => ({ ...storage, current: newCurrent }));
    },
    refreshModified: async (hasLocalChanges) => {
      let modified: ModifiedObjectStatus<RendererStorage>;

      if (hasLocalChanges !== false) {
        const results = await Promise.all([
          await request<string[]>('storage-read-modified-in-concepts'),
        ]);
        modified = {
          concepts: results[0],
        };
      } else {
        modified = {
          concepts: [],
        };
      }
      updateStorage(storage => ({ ...storage, modified }));
    },
  };

  const [storage, updateStorage] = useState(initStorage);

  useEffect(() => {
    storage.refresh();
    ipcRenderer.once('app-loaded', storage.refresh);
    ipcRenderer.on('concepts-changed', storage.refresh);

    storage.refreshModified();
    ipcRenderer.on('remote-storage-status', handleRemoteStorage);

    return function cleanup() {
      ipcRenderer.removeListener('app-loaded', storage.refresh);
      ipcRenderer.removeListener('concepts-changed', storage.refresh);

      ipcRenderer.removeListener('remote-storage-status', handleRemoteStorage);
    };
  }, []);

  async function handleRemoteStorage(evt: any, remoteStorageStatus: Partial<RemoteStorageStatus>) {
    await storage.refreshModified(remoteStorageStatus.hasLocalChanges);
  }

  return <StorageContext.Provider value={storage}>{children}</StorageContext.Provider>;
};


/* Context */

const StorageContext = React.createContext<StorageContextSpec<RendererStorage>>({
  current: {
    concepts: {},
  },

  refresh: async () => {},

  modified: {
    concepts: [],
  },

  refreshModified: async () => {},
});
