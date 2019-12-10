// import * as path from 'path';
// import * as fs from 'fs-extra';
// 
// import { StoreManager, Storage as BaseStorage } from 'sse/storage/main/storage';
// import { Workspace as BaseWorkspace } from 'sse/storage/workspace';
// import { Index } from 'sse/storage/query';
// 
// import { Concept } from 'models/concept';
// 
// 
// // Must match what’s specified in renderer/index.tsx
// const SUPPORTED_LANGUAGES = [
//   'eng',
//   'zho',
//   'rus',
// ]
// 
// 
// export class ConceptManager extends StoreManager<Concept> {
//   constructor() {
//     super('concepts');
//   }
// 
//   public async store(obj: Concept, storage: Storage, updateIndex = true): Promise<boolean> {
//     //await storage.fs.ensureDir(objPath);
// 
//     const storeable = Object.assign({}, obj);
//     storeable.termid = storeable.id;
//     delete storeable.id;
// 
//     const objPath = path.join(storage.workDir, this.rootDir, `concept-${obj.id}.yaml`);
//     await storage.yaml.store(objPath, storeable);
// 
//     if (updateIndex === true) {
//       await this.updateIndexedItem(obj, storage);
//     }
// 
//     return true;
//   }
// 
//   public postLoad(obj: any): Concept {
//     // TODO: Just use `id` field, ditch termid, update termbase & website.
//     obj.id = obj.termid;
//     return obj as Concept;
//   }
// 
//   public objectMatchesQuery(obj: Concept, query: string) {
//     const q = sanitize(query);
// 
//     if (sanitize(obj.term).indexOf(q) >= 0) {
//       return true;
//     }
// 
//     for (const lang of SUPPORTED_LANGUAGES) {
//       const term = obj[lang];
//       if (term && sanitize(term.term).indexOf(q) >= 0) {
//         return true;
//       }
//     }
// 
//     return false;
//   }
// }
// 
// 
// export interface Workspace extends BaseWorkspace {
//   concepts: Index<Concept>,
// }
// 
// 
// export class Storage extends BaseStorage<Workspace> {
//   public async findObjects(query?: string): Promise<Workspace> {
//     return {
//       concepts: await this.storeManagers.concepts.findObjects(this, query),
//     };
//   }
// 
//   public async loadObject(objPath: string): Promise<any | undefined> {
//     let objData: {[propName: string]: any};
//     const objFile = path.join(this.workDir, objPath);
//     objData = await this.yaml.load(objFile);
//     return objData;
//   }
// }
// 
// 
// // NOTE: Depends on repository being initialized (`initRepo()` should resolve prior)
// export async function initStorage(workDir: string): Promise<Storage> {
//   const storage = new Storage(fs, workDir, {
//     concepts: new ConceptManager(),
//   });
//   await storage.loadWorkspace();
//   return storage;
// }
// 
// 
// function sanitize(val: string): string {
//   return val.trim().toLowerCase();
// }
