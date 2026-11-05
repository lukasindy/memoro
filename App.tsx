import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, ScrollView, View, useColorScheme } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppData, emptyData, load, save } from './src/store';
import { Route, ScreenProps } from './src/nav';
import { ThemeCtx, dark, light } from './src/ui';
import { Home, NewCourse, Premium, Settings } from './src/screens/Home';
import { Course, LessonSettings, SectionView, Stats, Words } from './src/screens/Course';
import { AddWords } from './src/screens/AddWords';
import { Lesson, Result } from './src/screens/Lesson';

export default function App() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? dark : light;
  const [data, setData] = useState<AppData | null>(null);
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    load().then(setData);
  }, []);

  const update = useCallback((fn: (d: AppData) => AppData) => {
    setData((d) => {
      const next = fn(d ?? emptyData());
      save(next);
      return next;
    });
  }, []);

  const go = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const replace = useCallback((r: Route) => setStack((s) => [...s.slice(0, -1), r]), []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);

  const route = stack[stack.length - 1];

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [route]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, back]);

  let screen: React.ReactNode = <ActivityIndicator color={theme.primary} style={{ marginTop: 80 }} />;
  if (data) {
    const p: ScreenProps = { data, update, go, replace, back };
    switch (route.name) {
      case 'home': screen = <Home {...p} />; break;
      case 'newCourse': screen = <NewCourse {...p} />; break;
      case 'settings': screen = <Settings {...p} />; break;
      case 'premium': screen = <Premium {...p} reason={route.reason} />; break;
      case 'course': screen = <Course {...p} id={route.id} />; break;
      case 'section': screen = <SectionView {...p} id={route.id} index={route.index} />; break;
      case 'words': screen = <Words {...p} id={route.id} />; break;
      case 'stats': screen = <Stats {...p} id={route.id} />; break;
      case 'lessonSettings': screen = <LessonSettings {...p} id={route.id} />; break;
      case 'add': screen = <AddWords key={route.id} {...p} id={route.id} />; break;
      case 'lesson': screen = <Lesson key={stack.length} {...p} id={route.id} node={route.node} />; break;
      case 'result': screen = <Result {...p} {...route} />; break;
    }
  }

  return (
    <SafeAreaProvider>
      <ThemeCtx.Provider value={theme}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <ScrollView ref={scroll} contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
            <View style={{ width: '100%', maxWidth: 620, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, flexGrow: 1 }}>
              {screen}
            </View>
          </ScrollView>
        </SafeAreaView>
      </ThemeCtx.Provider>
    </SafeAreaProvider>
  );
}
