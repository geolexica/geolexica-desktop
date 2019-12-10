import { ipcRenderer } from 'electron';
import { openWindow } from 'sse/api/renderer';

import React, { useState, useEffect } from 'react';
import { Button, IconName, Tooltip, FormGroup, InputGroup, Intent, Icon, Popover, Position } from '@blueprintjs/core';

import { RemoteStorageStatus } from 'sse/storage/main/remote';
import { request } from 'sse/api/renderer';

import { useModified } from 'storage/renderer';

import * as styles from './styles.scss';


type AnyIDType = string | number;


interface StorageStatusProps {
  className?: string,
  iconClassName?: string,
  tooltipPosition?: Position,
}
export const StorageStatus: React.FC<StorageStatusProps> = function ({ className, iconClassName, tooltipPosition }) {
  const [remote, updateRemote] = useState({
    isMisconfigured: false,
    isOffline: false,
    hasLocalChanges: false,
    needsPassword: false,
    isPushing: false,
    isPulling: false,
    statusRelativeToLocal: undefined,
  } as RemoteStorageStatus);

  const modifiedIds = useModified();

  useEffect(() => {
    triggerInitialStorageSync();

    ipcRenderer.once('app-loaded', triggerInitialStorageSync);
    ipcRenderer.on('remote-storage-status', handleStorageStatusUpdate);

    return function cleanup() {
      ipcRenderer.removeListener('app-loaded', triggerInitialStorageSync);
      ipcRenderer.removeListener('remote-storage-status', handleStorageStatusUpdate);
    };
  }, []);

  const [passwordPromptIsOpen, openPasswordPrompt] = useState(false);

  useEffect(() => {
    openPasswordPrompt(remote.needsPassword);
  }, [remote.needsPassword]);

  async function triggerInitialStorageSync() {
    await ipcRenderer.send('remote-storage-trigger-sync');
  }

  function handleStorageStatusUpdate(evt: any, remoteStatus: Partial<RemoteStorageStatus>) {
    updateRemote(remote => ({ ...remote, ...remoteStatus }));
  }

  let statusIcon: IconName;
  let tooltipText: string | undefined;
  let statusIntent: Intent;
  let action: null | (() => void);

  if (remote.isMisconfigured) {
    statusIcon = "error";
    tooltipText = "Remote storage is missing configuration";
    statusIntent = "danger";
    action = () => openWindow('settings');

  } else if (remote.hasLocalChanges) {
    statusIcon = "git-commit";
    tooltipText = "Uncommitted local changes present—click to resolve";
    statusIntent = "warning";
    action = async () => {
      // Discard orphaned files, if any, before opening batch commit window
      const hasModifiedItems = Object.values(modifiedIds).
        reduce((acc, val) => { return [ ...acc, ...Object.keys(val) ] }, [] as AnyIDType[]).length > 0;
      if (remote.hasLocalChanges && !hasModifiedItems) {
        await ipcRenderer.send('remote-storage-discard-all');
        await ipcRenderer.send('remote-storage-trigger-sync');
      } else {
        openWindow('batch-commit');
      }
    }

  } else if (remote.needsPassword) {
    statusIcon = "lock";
    tooltipText = "Remote storage is pending authentication";
    statusIntent = "primary";
    action = null;

  } else if (remote.isOffline) {
    statusIcon = "offline";
    tooltipText = "No connection to remote storage—click to retry";
    statusIntent = "danger";
    action = () => ipcRenderer.send('remote-storage-trigger-sync');

  } else if (remote.isPulling) {
    statusIcon = "cloud-download"
    tooltipText = "Synchronizing remote storage…";
    statusIntent = "primary";
    action = null;

  } else if (remote.isPushing) {
    statusIcon = "cloud-upload"
    tooltipText = "Synchronizing remote storage…";
    statusIntent = "primary";
    action = null;

  } else if (remote.statusRelativeToLocal === 'diverged') {
    statusIcon = "git-branch"
    tooltipText = "Local and remote storage have diverging changes—click to retry";
    statusIntent = "danger";
    action = () => ipcRenderer.send('remote-storage-trigger-sync');

  } else if (remote.statusRelativeToLocal === 'behind') {
    statusIcon = "cloud-upload"
    tooltipText = "Pending changes to upload";
    statusIntent = "warning";
    action = null;

  } else {
    statusIcon = "updated"
    tooltipText = "Click to trigger remote storage sync";
    statusIntent = "success";
    action = () => ipcRenderer.send('remote-storage-trigger-sync');
  }

  return <div className={`${styles.storageStatusBase} ${className || ''}`}>
    <Popover minimal={true} content={<PasswordPrompt onConfirm={() => openPasswordPrompt(false)} />} position={tooltipPosition} isOpen={passwordPromptIsOpen}>
      <Tooltip position={tooltipPosition} intent={statusIntent} content={tooltipText}>
        {action !== null
          ? <Button
              className={`${styles.statusIcon} ${iconClassName || ''}`}
              icon={statusIcon}
              large={true}
              onClick={action}
              intent={statusIntent} />
          : <Icon
              icon={statusIcon}
              intent={statusIntent}
              className={`${styles.statusIcon} ${iconClassName || ''}`}
              iconSize={Icon.SIZE_LARGE} />}
      </Tooltip>
    </Popover>
  </div>;
};


const PasswordPrompt: React.FC<{ onConfirm: () => void }> = function ({ onConfirm }) {
  const [value, setValue] = useState('');

  async function handlePasswordConfirm() {
    await request<{ success: true }>('git-set-password', { password: value });
    onConfirm();
  }

  return <div className={styles.passwordPrompt}>
    <FormGroup
        label="Please enter repository password:"
        helperText="The password will be kept in memory and not stored to disk.">
      <InputGroup
        type="password"
        value={value}
        onChange={(event: React.FormEvent<HTMLElement>) => setValue((event.target as HTMLInputElement).value)}
        leftIcon="key"
        rightElement={
          value.trim() === ''
          ? undefined
          : <Button
                minimal={true}
                onClick={handlePasswordConfirm}
                icon="tick"
                intent="primary">
              Confirm
            </Button>}
      />
    </FormGroup>
  </div>;
};
