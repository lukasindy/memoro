import { AppData } from './store';

export type Route =
  | { name: 'home' }
  | { name: 'newCourse' }
  | { name: 'course'; id: string }
  | { name: 'add'; id: string }
  | { name: 'lesson'; id: string }
  | { name: 'result'; id: string; total: number; errors: number; xp: number }
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
