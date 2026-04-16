// Polyfill for new Array methods (Hermes < toReversed support)
if (!(Array.prototype as any).toReversed) {
  (Array.prototype as any).toReversed = function () {
    return [...this].reverse();
  };
}
if (!(Array.prototype as any).toSorted) {
  (Array.prototype as any).toSorted = function (cmp?: any) {
    return [...this].sort(cmp);
  };
}
if (!(Array.prototype as any).toSpliced) {
  (Array.prototype as any).toSpliced = function (start: number, deleteCount?: number, ...items: any[]) {
    const arr = [...this];
    arr.splice(start, deleteCount ?? arr.length - start, ...items);
    return arr;
  };
}
if (!(Array.prototype as any).with) {
  (Array.prototype as any).with = function (index: number, value: any) {
    const arr = [...this];
    arr[index] = value;
    return arr;
  };
}
// Дополнительные полифилы для старого Hermes
if (!(Array.prototype as any).flat) {
  (Array.prototype as any).flat = function (depth: number = 1) {
    const d = Math.max(0, depth);
    const res: any[] = [];
    const flatten = (arr: any[], current: number) => {
      for (const item of arr) {
        if (Array.isArray(item) && current < d) {
          flatten(item, current + 1);
        } else {
          res.push(item);
        }
      }
    };
    flatten(this, 0);
    return res;
  };
}
if (!(Array.prototype as any).flatMap) {
  (Array.prototype as any).flatMap = function (mapper: any, thisArg?: any) {
    return (this as any).map(mapper, thisArg).flat();
  };
}
if (!(Array.prototype as any).at) {
  (Array.prototype as any).at = function (index: number) {
    const len = this.length;
    const k = index < 0 ? len + index : index;
    return this[k];
  };
}
if (!(Array.prototype as any).findLast) {
  (Array.prototype as any).findLast = function (predicate: any, thisArg?: any) {
    for (let i = this.length - 1; i >= 0; i--) {
      if (predicate.call(thisArg, this[i], i, this)) return this[i];
    }
    return undefined;
  };
}
if (!(Array.prototype as any).findLastIndex) {
  (Array.prototype as any).findLastIndex = function (predicate: any, thisArg?: any) {
    for (let i = this.length - 1; i >= 0; i--) {
      if (predicate.call(thisArg, this[i], i, this)) return i;
    }
    return -1;
  };
}

import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemeProvider } from './src/theme/ThemeContext';
// Динамический импорт навигатора, чтобы отловить ошибки загрузки модуля
let AppNavigator: any;
let navigatorLoadError: any = null;
let navigatorModuleKeys: string[] = [];
try {
  const navModule = require('./src/navigation/AppNavigator');
  navigatorModuleKeys = Object.keys(navModule || {});
  console.log('AppNavigator module keys', navigatorModuleKeys);
  AppNavigator = navModule?.AppNavigator || navModule?.default;
  console.log('AppNavigator loaded type:', typeof AppNavigator);
} catch (e) {
  navigatorLoadError = e;
  console.error('AppNavigator require failed', e);
}

// Устанавливаем глобальный обработчик как можно раньше
const defaultHandler =
  (global as any)?.ErrorUtils?.getGlobalHandler &&
  (global as any).ErrorUtils.getGlobalHandler();

if ((global as any)?.ErrorUtils?.setGlobalHandler) {
  (global as any).ErrorUtils.setGlobalHandler((err: any, isFatal?: boolean) => {
    try {
      const payload =
        err && typeof err === 'object'
          ? { message: err.message, stack: err.stack, name: err.name }
          : err;
      // Максимально подробный лог
      console.error('GlobalError', JSON.stringify(payload), { isFatal });
    } catch (e) {
      console.error('GlobalError raw', err, { isFatal });
    }
    if (defaultHandler) {
      defaultHandler(err, isFatal);
    }
  });
}

// Дублируем для console.error, чтобы стек не терялся
const origConsoleError = console.error;
console.error = (...args: any[]) => {
  const enhanced = args.map((arg) => {
    if (arg && typeof arg === 'object' && (arg as any).stack) {
      return `${arg.message || ''}\n${arg.stack}`;
    }
    return arg;
  });
  origConsoleError(...enhanced);
};

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  componentDidCatch(error: Error) {
    console.error('AppErrorBoundary', error?.message, error?.stack);
    this.setState({ error });
  }
  render() {
    if (this.state.error) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle}>Что-то пошло не так</Text>
          <Text style={styles.fallbackText}>{this.state.error.message}</Text>
          <TouchableOpacity style={styles.fallbackBtn} onPress={() => this.setState({ error: null })}>
            <Text style={styles.fallbackBtnText}>Попробовать снова</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children as any;
  }
}

export default function App() {
  useEffect(() => {
    if (global.ErrorUtils && typeof global.ErrorUtils.setGlobalHandler === 'function') {
      global.ErrorUtils.setGlobalHandler((err: any, isFatal?: boolean) => {
        console.error('GlobalError', err?.message, err?.stack, { isFatal });
      });
    }
  }, []);

  // Диагностика: если навигатор не инициализировался
  if (!AppNavigator) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Навигация не загрузилась</Text>
        <Text style={styles.fallbackText}>AppNavigator is undefined или не импортирован</Text>
        {navigatorModuleKeys.length ? (
          <Text style={styles.fallbackText}>Ключи модуля: {navigatorModuleKeys.join(', ')}</Text>
        ) : (
          <Text style={styles.fallbackText}>Ключи модуля пустые</Text>
        )}
        {navigatorLoadError ? (
          <Text style={styles.fallbackText}>Ошибка: {String(navigatorLoadError?.message || navigatorLoadError)}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <ThemeProvider>
      <StatusBar style="auto" />
      <AppErrorBoundary>
        <AppNavigator />
      </AppErrorBoundary>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#f6f7fb' },
  fallbackTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  fallbackText: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 12 },
  fallbackBtn: { backgroundColor: '#0ea5e9', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  fallbackBtnText: { color: '#fff', fontWeight: '700' },
});
