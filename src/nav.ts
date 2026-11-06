import { AppData } from './store';
import type { Extra, LevelUp, NodeKind } from './engine';
import type { CourseTab } from './screens/Course';

export type LessonRef = { key: string; kind: NodeKind | 'skip'; wordIds: string[]; section: number };
export type LessonKind = NodeKind | 'skip' | 'review';

export type Route =
  | { name: 'home' }
  | { name: 'newCourse' }
  | { name: 'course'; id: string; tab?: CourseTab; sec?: number }
  | { name: 'add'; id: string }
  | { name: 'lesson'; id: string; node?: LessonRef } // ohne node = Wiederholung
  | { name: 'result'; id: string; total: number; errors: number; xp: number; kind: LessonKind; passed: boolean; boosted?: boolean; up?: LevelUp | null; extra?: Extra }
  | { name: 'settings' }
  | { name: 'inventory' }
  | { name: 'premium'; reason: string };

export type ScreenProps = {
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
  go: (r: Route) => void;
  replace: (r: Route) => void;
  back: () => void;
};
