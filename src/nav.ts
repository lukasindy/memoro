import { AppData } from './store';
import type { NodeKind } from './engine';

export type LessonRef = { key: string; kind: NodeKind | 'skip'; wordIds: string[]; section: number };
export type LessonKind = NodeKind | 'skip' | 'review';

export type Route =
  | { name: 'home' }
  | { name: 'newCourse' }
  | { name: 'course'; id: string }
  | { name: 'add'; id: string }
  | { name: 'section'; id: string; index: number }
  | { name: 'lesson'; id: string; node?: LessonRef } // ohne node = Wiederholung
  | { name: 'result'; id: string; total: number; errors: number; xp: number; kind: LessonKind; passed: boolean }
  | { name: 'lessonSettings'; id: string }
  | { name: 'words'; id: string }
  | { name: 'stats'; id: string }
  | { name: 'settings' }
  | { name: 'premium'; reason: string };

export type ScreenProps = {
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
  go: (r: Route) => void;
  replace: (r: Route) => void;
  back: () => void;
};
