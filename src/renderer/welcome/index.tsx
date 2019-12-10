//import React from 'react';
//
//import { clipboard } from 'electron';
//
//import { UL, Button, Callout } from '@blueprintjs/core';
//
//import { RepositoryConfigurator } from 'sse/storage/renderer/repository-configurator';
//import { getStatic } from 'sse/renderer/static';
//
//import styles from './styles.scss';
//
//
//interface WelcomeScreenProps {
//  defaultRepoUrl: string,
//}
//export const Welcome: React.FC<WelcomeScreenProps> = function ({ defaultRepoUrl }) {
//  async function copyUpstreamRepoURL() {
//    clipboard.writeText(defaultRepoUrl);
//  }
//
//  console.debug(styles.base);
//
//  return (
//    <div className={styles.base}>
//      <div className={styles.intro}>
//        <img src={getStatic('osgeo-logo-cmyk.svg')} alt="OSGeo" className={styles.logo} />
//      </div>
//
//      <Callout
//          intent="primary"
//          className={styles.repoUrlInstructions}
//          title="Before you start, please configure your data repository URL">
//
//        <UL>
//          <li>
//            If you were given a repository URL to use, paste it in the text field below.
//          </li>
//          <li>
//            <p>
//              If you were instructed to create a <em>fork</em> to work with,
//              click this button to copy upstream repository page URL:
//            </p>
//            <p>
//              <Button onClick={copyUpstreamRepoURL}>Copy upstream repository URL</Button>
//            </p>
//            <p>
//              Open the&nbsp;copied link in&nbsp;your&nbsp;browser
//              and&nbsp;look&nbsp;for&nbsp;the&nbsp;button to&nbsp;create a&nbsp;fork.
//              Note: you&nbsp;will&nbsp;be&nbsp;required to&nbsp;create
//              a&nbsp;GitHub&nbsp;account if&nbsp;you don’t already have&nbsp;one.
//            </p>
//          </li>
//          <li>
//            Leave URL empty to use upstream URL—do so with care!
//          </li>
//          <li>
//            You will&nbsp;be&nbsp;able&nbsp;to&nbsp;change the&nbsp;URL later,
//            but&nbsp;you will&nbsp;lose any&nbsp;unsubmitted changes with&nbsp;that.
//          </li>
//        </UL>
//
//        <RepositoryConfigurator defaultUrl={defaultRepoUrl} className={styles.repoConfig} />
//
//      </Callout>
//    </div>
//  );
//};

