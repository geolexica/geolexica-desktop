import AsyncLock from 'async-lock';
import { remote, ipcRenderer } from 'electron';
import { debounce } from 'throttle-debounce';

import React, { useContext, useState, useEffect } from 'react';

import { H2, Tooltip, Button, EditableText, Position } from '@blueprintjs/core';
import { Toaster } from '@blueprintjs/core';

import { LangConfigContext } from 'sse/localizer/renderer';
import { PaneHeader } from 'sse/renderer/widgets/pane-header';
import { request, notifyAllWindows } from 'sse/api/renderer';

import { useModified } from 'storage/renderer';
import { ObjectStorageStatus } from 'renderer/widgets/change-status';
import { LangSelector } from 'renderer/lang';
import { Concept as ConceptModel } from 'models/concept';

import styles from './styles.scss';


const operationLock = new AsyncLock();

var objectUpdate: NodeJS.Timer;

 
export const WindowToaster = Toaster.create({
    className: "window-toaster",
    position: Position.BOTTOM,
});


export const Concept: React.FC<{ id: string }> = function ({ id }) {
  const [concept, _updateConcept] = useState(undefined as ConceptModel | undefined);

  /* Issue change status */

  const modifiedConcepts = useModified().concepts;
  const [haveSaved, setSaved] = useState(undefined as boolean | undefined);
  const [hasUncommittedChanges, setHasUncommittedChanges] = useState(false);

  useEffect(() => {
    const _hasUncommittedChanges = modifiedConcepts.indexOf(parseInt(id, 10)) >= 0;
    setHasUncommittedChanges(_hasUncommittedChanges);
  }, [modifiedConcepts]);

  const lang = useContext(LangConfigContext);


  async function fetchConcept() {
    const _concept = (await request<ConceptModel>('concept', { id })) as ConceptModel;
    _updateConcept(_concept);
  }

  async function _storageUpdateConcept(data: ConceptModel, commit?: true) {
    await operationLock.acquire('update-issue', async () => {
      clearTimeout(objectUpdate);

      const updateResult = await request<{ modified: boolean }>
        ('concept-update', { id: parseInt(id, 10), data, commit: commit });

      if (commit) {
        await ipcRenderer.send('remote-storage-trigger-sync');
      } else {
        await ipcRenderer.send('remote-storage-trigger-uncommitted-check');
      }

      objectUpdate = setTimeout(() => {
        setHasUncommittedChanges(updateResult.modified);
        setSaved(true);
      }, 500);
    });
  }
  const storageUpdateConcept = debounce(500, _storageUpdateConcept);

  const term = (concept ? concept[lang.selected] : undefined) || {};


  /* Update operations */

  async function updateConcept(data: ConceptModel) {
    setSaved(false);
    _updateConcept(data);

    await storageUpdateConcept(data);
  }

  async function handleCommitAndQuit() {
    if (concept !== undefined) {
      try {
        await _storageUpdateConcept(concept, true);
      } catch (e) {
        WindowToaster.show({ intent: 'danger', message: "Failed to commit changes" });
        return;
      }
      await notifyAllWindows('concepts-changed');
      remote.getCurrentWindow().close();
    }
  }

  useEffect(() => {
    fetchConcept();
  }, []);

  function updateTerm(val: string) {
    if (concept) {
      var newConcept = {
        ...concept,
        [lang.selected]: {
          ...concept[lang.selected],
          term: val,
        },
      } as ConceptModel;

      if (lang.selected === lang.default) {
        newConcept.term = val;
      }

      updateConcept(newConcept);
    }
  }

  function updateDefinition(val: string) {
    if (concept) {
      const newConcept = {
        ...concept,
        [lang.selected]: {
          ...concept[lang.selected],
          definition: val,
        },
      } as ConceptModel;
      updateConcept(newConcept);
    }
  }

  function updateAuthSource(val: string) {
    if (concept) {
      const newConcept = {
        ...concept,
        [lang.selected]: {
          ...concept[lang.selected],
          authoritative_source: { ...concept[lang.selected].authoritative_source, link: val },
        },
      } as ConceptModel;
      updateConcept(newConcept);
    }
  }

  function handleNewComment(val: string) {
    if (concept) {
      const newConcept = {
        ...concept,
        [lang.selected]: {
          ...concept[lang.selected],
          comments: [ val, ...(term.comments || []) ],
        },
      } as ConceptModel;
      updateConcept(newConcept);
    }
  }

  function handleCommentEdit(commentIdx: number, updatedComment: string) {
    if (concept) {
      var newComments = [ ...(term.comments || []) ];
      newComments[commentIdx] = updatedComment;

      const newConcept = {
        ...concept,
        [lang.selected]: {
          ...concept[lang.selected],
          comments: newComments,
        },
      } as ConceptModel;
      updateConcept(newConcept);
    }
  }

  function handleCommentDeletion(commentIdx: number) {
    if (concept) {
      var newComments = [ ...(term.comments || []) ];
      newComments.splice(commentIdx, 1);

      const newConcept = {
        ...concept,
        [lang.selected]: {
          ...concept[lang.selected],
          comments: newComments,
        },
      } as ConceptModel;
      updateConcept(newConcept);
    }
  }

  return (
    <div className={styles.conceptBase}>
      <PaneHeader align="right">
        Concept
        &ensp;
        <Tooltip position={Position.RIGHT_TOP} content="Concept IDs are set internally and cannot be changed"><span className={styles.conceptIdHighlight}>{id}</span></Tooltip>
        &emsp;
        <LangSelector />
        &emsp;
        <ObjectStorageStatus
          haveSaved={haveSaved}
          hasUncommittedChanges={hasUncommittedChanges}
          onCommit={handleCommitAndQuit} />
      </PaneHeader>

      <H2 className={styles.conceptHeader}>
        <EditableText
          placeholder="Edit term…"
          intent={(term.term || '').trim() === '' ? "danger" : undefined}
          onChange={(val: string) => { updateTerm(val) }}
          value={term.term || ''} />
      </H2>

      <div className={styles.authSource}>
        <EditableText
          placeholder="Edit authoritative source…"
          intent={((term.authoritative_source || {}).link || '').trim() === '' ? "danger" : undefined}
          onChange={(val: string) => { updateAuthSource(val); }}
          value={(term.authoritative_source || {}).link || ''} />
        <Tooltip position={Position.RIGHT_TOP} content="Open authoritative source in a new window">
          <Button
            minimal={true}
            small={true}
            intent="primary"
            onClick={() => require('electron').shell.openExternal((term.authoritative_source || {}).link || '')}>Open…</Button>
        </Tooltip>
      </div>

      <div className={styles.conceptDefinition}>
        <EditableText
          placeholder="Edit definition…"
          intent={(term.definition || '').trim() === '' ? "danger" : undefined}
          multiline={true}
          onChange={(val: string) => { updateDefinition(val); }}
          value={term.definition || ''} />
      </div>

      <div className={styles.conceptComments}>
        <PaneHeader align="left" className={styles.conceptCommentsHeader}>
          {(term.comments || []).length} comment{(!(term.comments || []).length || (term.comments || []).length > 1) ? 's' : null}
        </PaneHeader>

        <Comments
          comments={term.comments || []}
          onCreate={handleNewComment}
          onUpdate={handleCommentEdit}
          onDelete={handleCommentDeletion} />
      </div>
    </div>
  );
};


interface CommentsProps {
  comments: string[],
  onCreate: (c: string) => void,
  onUpdate: (idx: number, c: string) => void,
  onDelete: (idx: number) => void,
}
const Comments: React.FC<CommentsProps> = function ({ comments, onCreate, onUpdate, onDelete }) {
  const [newComment, updateNewComment] = useState('');

  return <div className={styles.commentList}>
    <div className={styles.comment}>
      <EditableText
        value={newComment}
        placeholder="New comment…"
        onChange={updateNewComment}
        multiline={false}
      />

      {newComment !== ''
        ? <Button onClick={() => {
                onCreate(newComment);
                updateNewComment('');
              }}
              className={styles.commentAddButton}
              fill={true}
              minimal={true}
              intent="primary">
            Add comment
          </Button>
        : null}
    </div>

    {[...comments.entries()].map(([idx, c]: [number, string]) => <Comment key={idx} content={c} />)}
  </div>;
}


const Comment: React.FC<{ content: string }> = function ({ content }) {
  return <div className={styles.comment}>
    {content}
  </div>
}
