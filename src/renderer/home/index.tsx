import AsyncLock from 'async-lock';
import { ipcRenderer } from 'electron';
import { openWindow } from 'sse/api/renderer';

import React, { useState, useEffect, useContext } from 'react';

import { Position, Tooltip, NonIdealState, Button, Spinner, Icon, InputGroup } from '@blueprintjs/core';

import { RemoteStorageStatus } from 'sse/storage/main/remote';
import { LangConfigContext } from 'sse/localizer/renderer';
import { PaneHeader } from 'sse/renderer/widgets/pane-header';
import { request } from 'sse/api/renderer';

import { StorageStatus } from 'renderer/sync-status';
import { LangSelector } from 'renderer/lang';
import { Concept } from 'models/concept';

import styles from './styles.scss';


const lock = new AsyncLock();
const SINGLETON_LOCK = '1';


export const Home: React.FC<{}> = function () {
  const [concepts, updateConcepts] = useState([] as Concept[]);
  const [total, updateTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(undefined as undefined | string);

  async function reloadConcepts() {
    setLoading(true);
    const result = await request<{ items: Concept[], total: number }>(
      'search-concepts',
      { query });
    setLoading(false);
    updateConcepts(result.items);
    updateTotal(result.total);
  }

  async function fetchQuery() {
    await lock.acquire(SINGLETON_LOCK, async function () {
      await reloadConcepts();
    });
  }

  function handleStorageStatus(evt: any, status: Partial<RemoteStorageStatus>) {
    if (status.statusRelativeToLocal === 'updated') {
      setLoading(false);
      reloadConcepts();
    }
  }

  useEffect(() => {
    reloadConcepts();
    ipcRenderer.once('app-loaded', reloadConcepts);
    ipcRenderer.on('concepts-changes', reloadConcepts);
    ipcRenderer.on('remote-storage-status', handleStorageStatus);
    return function cleanup() {
      ipcRenderer.removeListener('app-loaded', reloadConcepts);
      ipcRenderer.removeListener('concepts-changes', reloadConcepts);
      ipcRenderer.removeListener('remote-storage-status', handleStorageStatus);
    };
  }, []);

  useEffect(() => {
    fetchQuery();
  }, [query]);

  const maybeSpinner = loading ? <Spinner size={Icon.SIZE_STANDARD} /> : undefined;

  return (
    <div className={styles.homeBase}>
      <PaneHeader align="right">
        ISO/TC 211 Geolexica Concepts

        &emsp;

        <LangSelector />

        &emsp;

        <div className={styles.status}>

          <DataBarButton
              onClick={() => openWindow('settings')}
              title="Settings">
            <Icon icon="settings" />
          </DataBarButton>

          <StorageStatus
            tooltipPosition={Position.BOTTOM}
            iconClassName={styles.storageStatusIcon} />

        </div>

      </PaneHeader>

      <div className={styles.searchControls}>
        <InputGroup
          placeholder="Type to search…"
          large={true}
          rightElement={maybeSpinner}
          value={query || ''}
          type="text"
          onChange={(evt: React.FormEvent<HTMLElement>) => {
            const newQuery = (evt.target as HTMLInputElement).value as string;
            if (newQuery.trim() !== '') {
              setQuery(newQuery);
            } else {
              setQuery(undefined);
            }
          }}
        />
      </div>

      <main className={styles.conceptCollection}>
        {concepts.length > 0
          ? <>
              {concepts.map((concept) => (
                <ConceptItem concept={concept} />
              ))}
              <div className={styles.conceptCollectionTotal}>
                <p>Showing {concepts.length} out of {total} result(s) found</p>
              </div>
            </>
          : <NonIdealState
              title="Nothing to display"
              icon="zoom-out" />}
      </main>
    </div>
  );
};


const ConceptItem: React.FC<{ concept: Concept }> = function ({ concept }) {
  const lang = useContext(LangConfigContext);
  const term = concept[lang.selected];

  let hasComments, hasNotes, hasExamples: boolean;

  if (term) {
    hasComments = (term.comments || []).length > 0;
    hasNotes = (term.notes || []).length > 0;
    hasExamples = (term.examples || []).length > 0;
  } else {
    hasComments = false;
    hasNotes = false;
    hasExamples = false;
  }

  return (
    <li className={styles.conceptItem} onClick={() => openWindow('concept', { id: `${concept.id}`, lang: lang.selected })}>
      <p className={styles.title}>
        <a>{(term || concept).term}</a>
      </p>
      <div className={styles.icons}>
        {term
          ? <>
              <Icon icon="comment"
                htmlTitle={hasComments ? "Has comments" : undefined}
                className={hasComments ? styles.activeIcon : undefined}
                intent={hasComments ? "primary" : undefined} />
              <Icon icon="annotation"
                htmlTitle={hasNotes ? "Has notes" : undefined}
                className={hasNotes ? styles.activeIcon : undefined}
                intent={hasNotes ? "primary" : undefined} />
              <Icon icon="citation"
                htmlTitle={hasExamples ? "Has examples" : undefined}
                className={hasExamples ? styles.activeIcon : undefined}
                intent={hasExamples ? "primary" : undefined} />
            </>
          : <><span>missing term</span> <Icon icon="warning-sign" /></>}
      </div>
    </li>
  );
};


const DataBarButton: React.FC<{ onClick: () => void, buttonClassName?: string, title: string }> = function ({ onClick, buttonClassName, title, children }) {
  return (
    <div className={styles.dataBarButtonWithTooltip}>
      <Tooltip content={title} position={Position.RIGHT}>
        <Button
            large={true}
            title={title}
            minimal={true}
            className={buttonClassName}
            onClick={onClick}>
          {children}
        </Button>
      </Tooltip>
    </div>
  );
};
