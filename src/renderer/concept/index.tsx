import { remote } from 'electron';

import React, { useContext, useState, useEffect } from 'react';

import { H2, Tooltip, Button, EditableText, Position } from '@blueprintjs/core';

import { LangConfigContext } from 'sse/localizer/renderer';
import { PaneHeader } from 'sse/renderer/widgets/pane-header';
import { request } from 'sse/api/renderer';

import { LangSelector } from 'renderer/lang';
import { Concept as ConceptModel } from 'models/concept';

import styles from './styles.scss';


export const Concept: React.FC<{ id: string }> = function ({ id }) {
  const [concept, updateConcept] = useState(undefined as ConceptModel | undefined);

  console.debug(id);

  console.debug(concept);

  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  const [term, updateTerm] = useState('' as string);
  const [definition, updateDefinition] = useState('' as string);
  const [authSource, updateAuthSource] = useState('' as string);
  const [comments, updateComments] = useState([] as string[]);

  const lang = useContext(LangConfigContext);

  async function fetchConcept() {
    setLoading(true);
    const _concept = (await request<ConceptModel>('concept', { id })) as ConceptModel;
    updateConcept(_concept);
    setLoading(false);
  }

  async function handleSaveClick() {
    if (concept) {
      setLoading(true);

      const newConcept = {
        ...concept,
        [lang.selected]: {
          ...concept[lang.selected],
          comments: comments,
          term: term,
          definition: definition,
          authoritative_source: { link: authSource },
        },
      } as ConceptModel;

      if (lang.selected === lang.default) {
        newConcept.term = term;
      }

      await request<void>('concept', JSON.stringify({ id: id }), JSON.stringify({ newData: newConcept }));

      setDirty(false);
      setLoading(false);

      remote.getCurrentWindow().close();
    }
  }

  useEffect(() => {
    fetchConcept();
  }, []);

  useEffect(() => {
    if (concept) {
      const term = concept[lang.selected] || {};
      updateComments(term.comments || []);
      updateTerm(term.term || '');
      updateDefinition(term.definition || '');
      updateAuthSource((term.authoritative_source || {}).link || '');
    }
  }, [concept, lang.selected]);

  function handleNewComment(newComment: string) {
    updateComments([ newComment, ...comments ]);
    setDirty(true);
  }

  function handleCommentEdit(commentIdx: number, updatedComment: string) {
    var newComments = [...comments];
    newComments[commentIdx] = updatedComment;
    updateComments(newComments);
    setDirty(true);
  }

  function handleCommentDeletion(commentIdx: number) {
    var newComments = [...comments];
    newComments.splice(commentIdx, 1);
    updateComments(newComments);
    setDirty(true);
  }

  return (
    <div className={styles.conceptBase}>
      <PaneHeader align="right">
        Concept
        &ensp;
        <Tooltip position={Position.RIGHT_TOP} content="Concept IDs are set internally and cannot be changed"><span className={styles.conceptIdHighlight}>{id}</span></Tooltip>
        &emsp;
        <LangSelector />
      </PaneHeader>

      <H2 className={styles.conceptHeader}>
        <EditableText
          placeholder="Edit term…"
          intent={term.trim() === '' ? "danger" : undefined}
          onChange={(val: string) => { setDirty(true); updateTerm(val) }}
          value={term} />
      </H2>

      <div className={styles.authSource}>
        <EditableText
          placeholder="Edit authoritative source…"
          intent={authSource.trim() === '' ? "danger" : undefined}
          onChange={(val: string) => { setDirty(true); updateAuthSource(val); }}
          value={authSource}/>
        <Tooltip position={Position.RIGHT_TOP} content="Open authoritative source in a new window">
          <Button
            minimal={true}
            small={true}
            intent="primary"
            onClick={() => require('electron').shell.openExternal(authSource)}>Open…</Button>
        </Tooltip>
      </div>

      <div className={styles.conceptDefinition}>
        <EditableText
          placeholder="Edit definition…"
          intent={definition.trim() === '' ? "danger" : undefined}
          multiline={true}
          onChange={(val: string) => { setDirty(true); updateDefinition(val); }}
          value={definition}/>
      </div>

      <div className={styles.conceptComments}>
        <PaneHeader align="left" className={styles.conceptCommentsHeader}>
          {comments.length} comment{(!comments.length || comments.length > 1) ? 's' : null}
        </PaneHeader>

        <Comments
          comments={comments}
          onCreate={handleNewComment}
          onUpdate={handleCommentEdit}
          onDelete={handleCommentDeletion} />
      </div>

      <footer className={styles.actions}>
        <Button
          disabled={loading || !dirty || term.trim() === ''}
          large={true}
          minimal={false}
          intent="primary"
          onClick={handleSaveClick}
          icon="tick">Save and close</Button>
      </footer>
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
