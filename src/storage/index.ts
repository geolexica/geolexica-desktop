import { Storage as BaseStorage } from 'sse/storage';

import { Concept } from 'models/concept';


export interface Storage extends BaseStorage {
  concepts: Concept,
}
