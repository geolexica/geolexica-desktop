import * as path from 'path';
import { MainStorage as BaseMainStorage } from 'sse/storage/main';
import { GitFilesystemStore } from 'sse/storage/main/store/git-filesystem';
import { YAMLBackend } from 'sse/storage/main/filesystem/yaml';
import { GitController } from 'sse/storage/main/git/controller';

import { Storage } from '.';


type Concept = Storage['concepts']


const SUPPORTED_LANGUAGES = [
  'eng',
  'zho',
  'rus',
  'msa',
  'kor',
]


export class ConceptYAMLBackend extends YAMLBackend<Concept> {
  constructor(baseDir: string) { super(baseDir); }

  parseData(data: string) {
    var obj: any = super.parseData(data);
    obj.id = obj.termid;
    return obj as Concept;
  }

  expandPath(objId: string) {
    // In this case, path to object should include YAML extension.
    const expandedPath = super.expandPath(`concept-${objId}`);
    return expandedPath;
  }

  async resolveObjectId(objId: string) {
    const pathWithExt = await super.resolveObjectId(objId);
    const pathWithoutExt = path.basename(pathWithExt, '.yaml');
    const pathWithoutPrefix = pathWithoutExt.replace('concept-', '');
    return pathWithoutPrefix;
  }
}


export class ConceptStore extends GitFilesystemStore<Concept, ConceptYAMLBackend, number> {

  objectMatchesQuery(obj: Concept, query: string) {
    const q = sanitizeQuery(query);

    if (sanitizeQuery(obj.term).indexOf(q) >= 0) {
      return true;
    }

    for (const lang of SUPPORTED_LANGUAGES) {
      const term = obj[lang];
      if (term && sanitizeQuery(term.term).indexOf(q) >= 0) {
        return true;
      }
    }

    return false;
  }
}


export interface MainStorage extends BaseMainStorage<Storage> {
  concepts: ConceptStore,
}


export function getStorage(gitCtrl: GitController): MainStorage {
  const storage: MainStorage = {
    concepts: new ConceptStore(
      'concept',
      new ConceptYAMLBackend(path.join(gitCtrl.workDir, 'concepts')),
      gitCtrl,
      'termid'),
  }
  return storage;
}


function sanitizeQuery(val: string): string {
  return val.trim().toLowerCase();
}
