import AsyncLock from 'async-lock';
import { remote, ipcRenderer } from 'electron';
import { debounce } from 'throttle-debounce';

import React, { useContext, useState, useEffect } from 'react';

import { H2, Tooltip, Button, EditableText, Position, Checkbox, Menu, Popover } from '@blueprintjs/core';
import { Toaster } from '@blueprintjs/core';

import { LangConfigContext } from 'sse/localizer/renderer';
import { PaneHeader } from 'sse/renderer/widgets/pane-header';
import { request, notifyAllWindows } from 'sse/api/renderer';

import { useModified } from 'storage/renderer';
import { ObjectStorageStatus } from 'renderer/widgets/change-status';
import { DateStamp } from 'renderer/widgets/dates';
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

  function togglePreferredStatus() {
    if (concept) {
      var newConcept = {
        ...concept,
        [lang.selected]: {
          ...concept[lang.selected],
        },
      } as ConceptModel;

      const preferred = newConcept[lang.selected].classification === 'preferred';

      if (preferred) {
        delete newConcept[lang.selected].classification;
      } else {
        newConcept[lang.selected].classification = 'preferred';
      }

      updateConcept(newConcept);
    }
  }

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

  function updateEntryStatus(val: string) {
    if (concept) {
      const newConcept = {
        ...concept,
        [lang.selected]: {
          ...concept[lang.selected],
          entry_status: val,
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

  function handleNewNote(val: string) {
    if (concept) {
      const newConcept = {
        ...concept,
        [lang.selected]: {
          ...concept[lang.selected],
          notes: [ val, ...(term.notes || []) ],
        },
      } as ConceptModel;
      updateConcept(newConcept);
    }
  }

  function handleNoteEdit(noteIdx: number, updatedNote: string) {
    if (concept) {
      var newNotes = [ ...(term.notes || []) ];
      newNotes[noteIdx] = updatedNote;

      const newConcept = {
        ...concept,
        [lang.selected]: {
          ...concept[lang.selected],
          notes: newNotes,
        },
      } as ConceptModel;
      updateConcept(newConcept);
    }
  }

  function handleNoteDeletion(noteIdx: number) {
    if (concept) {
      var newNotes = [ ...(term.notes || []) ];
      newNotes.splice(noteIdx, 1);

      const newConcept = {
        ...concept,
        [lang.selected]: {
          ...concept[lang.selected],
          notes: newNotes,
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
          placeholder="Edit authoritative source URL…"
          intent={((term.authoritative_source || {}).link || '').trim() === '' ? "danger" : undefined}
          onChange={(val: string) => { updateAuthSource(val); }}
          value={(term.authoritative_source || {}).link || ''} />

        <div className={styles.authSourceRef}>
          <EditableText
            placeholder="Edit source reference…"
            intent={((term.authoritative_source || {}).ref || '').trim() === '' ? "danger" : undefined}
            onChange={(val: string) => { updateAuthSource(val); }}
            value={(term.authoritative_source || {}).ref || ''} />
          <EditableText
            placeholder="Edit source clause…"
            intent={((term.authoritative_source || {}).clause || '').trim() === '' ? "danger" : undefined}
            onChange={(val: string) => { updateAuthSource(val); }}
            value={(term.authoritative_source || {}).clause || ''} />
        </div>

        {((term.authoritative_source || {}).link || '').trim() !== ''
          ? <Tooltip position={Position.RIGHT_TOP} content="Open authoritative source in a new window">
              <Button
                minimal={true}
                small={true}
                intent="primary"
                onClick={() => require('electron').shell.openExternal((term.authoritative_source || {}).link || '')}>Open…</Button>
            </Tooltip>
          : null}
      </div>

      <div className={styles.preferredStatus}>
        <Checkbox
          checked={(term.classification || '') === 'preferred'}
          label="Is preferred"
          onChange={() => togglePreferredStatus()} />
      </div>

      <div className={styles.entryStatus}>
        <span>Entry status</span>
        <Popover content={<EntryStatusMenu onSelect={(status: string) => updateEntryStatus(status)}/>} position={Position.RIGHT_TOP}>
          <Button
            text={term.entry_status || 'Choose…'}
            intent={term.entry_status ? undefined : 'primary'} />
        </Popover>
      </div>

      <div className={styles.conceptDefinition}>
        <EditableText
          placeholder="Edit definition…"
          intent={(term.definition || '').trim() === '' ? "danger" : undefined}
          multiline={true}
          onChange={(val: string) => { updateDefinition(val); }}
          value={term.definition || ''} />
      </div>

      <div className={styles.conceptReview}>
        {term.review_status
          ? <ConceptReview review={term} />
          : null}
      </div>

      <div className={styles.conceptNotesAndComments}>
        <div className={styles.conceptComments}>
          <PaneHeader align="left" className={styles.conceptCommentsHeader}>
            {(term.comments || []).length} comment{(!(term.comments || []).length || (term.comments || []).length > 1) ? 's' : null}
          </PaneHeader>

          <Comments
            comments={term.comments || []}
            newObjectLabel="comment"
            onCreate={handleNewComment}
            onUpdate={handleCommentEdit}
            onDelete={handleCommentDeletion} />
        </div>

        <div className={styles.conceptComments}>
          <PaneHeader align="left" className={styles.conceptCommentsHeader}>
            {(term.notes || []).length} note{(!(term.notes || []).length || (term.notes || []).length > 1) ? 's' : null}
          </PaneHeader>

          <Comments
            comments={term.notes || []}
            newObjectLabel="note"
            onCreate={handleNewNote}
            onUpdate={handleNoteEdit}
            onDelete={handleNoteDeletion} />
        </div>
      </div>
    </div>
  );
};


interface CommentsProps {
  comments: string[],
  newObjectLabel: string,
  onCreate: (c: string) => void,
  onUpdate: (idx: number, c: string) => void,
  onDelete: (idx: number) => void,
}
const Comments: React.FC<CommentsProps> = function ({ comments, newObjectLabel, onCreate, onUpdate, onDelete }) {
  const [newComment, updateNewComment] = useState('');

  return <div className={styles.commentList}>
    <div className={styles.comment}>
      <EditableText
        value={newComment}
        placeholder={`New ${newObjectLabel}…`}
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
            Add {newObjectLabel}
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


const ENTRY_STATUSES = [
  'valid',
  'superseded',
  'retired',
]


const EntryStatusMenu: React.FC<{ onSelect: (status: string) => void }> = function ({ onSelect }) {
  return (
    <Menu>
      {ENTRY_STATUSES.map(status => <Menu.Item onClick={() => onSelect(status)} text={status} />)}
    </Menu>
  );
}


type Review = {
  review_date: Date,
  review_status: 'final' | 'pending',
  review_type: 'retirement' | 'supercession',
  review_decision_date: Date,
  review_decision: string,
  review_decision_event: string,
  review_decision_notes: string,
}


const ConceptReview: React.FC<{ review: Review }> = function ({ review }) {
  return (
    <div className={styles.review}>
      <div className={styles.reviewStatus}>
        Review status: <strong>{review.review_status || '(unknown status)'}</strong>
        {review.review_type ? <> for <strong>{review.review_type}</strong></> : null}
        {review.review_date ? <> since <DateStamp date={review.review_date} /></> : null}
      </div>
      {review.review_decision
        ? <div className={styles.reviewDecision}>
            Decision: <strong>{review.review_decision}</strong>
            {review.review_decision_date ? <> as of <DateStamp date={review.review_decision_date} /></> : null}
          </div>
        : null}
    </div>
  );
}
