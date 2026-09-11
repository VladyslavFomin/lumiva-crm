import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutChangeEvent, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme, fonts } from '../../theme/ThemeContext';

export interface ViewTab {
  key: string;
  label: string;
}

interface Props {
  tabs: ViewTab[];
  activeKey: string;
  onChange: (key: string) => void;
}

/** Underline tab switcher — mirrors the web app's `.lv-view-tab` (Список/Канбан/Календарь/...). */
export const ViewTabs: React.FC<Props> = ({ tabs, activeKey, onChange }) => {
  const { colors } = useTheme();
  const layouts = useRef<Record<string, { x: number; width: number }>>({});
  const [, forceRender] = useState(0);
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);

  const indicatorStyle = useAnimatedStyle(() => ({
    left: indicatorX.value,
    width: indicatorW.value,
  }));

  const handleLayout = (key: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    layouts.current[key] = { x, width };
    if (key === activeKey) {
      indicatorX.value = x;
      indicatorW.value = width;
    }
    forceRender((n) => n + 1);
  };

  const handlePress = (key: string) => {
    onChange(key);
    const l = layouts.current[key];
    if (l) {
      indicatorX.value = withSpring(l.x, { damping: 20, stiffness: 200 });
      indicatorW.value = withSpring(l.width, { damping: 20, stiffness: 200 });
    }
  };

  return (
    <View style={[styles.wrap, { borderBottomColor: colors.line3 }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {tabs.map((t) => {
            const isActive = t.key === activeKey;
            return (
              <Pressable key={t.key} onPress={() => handlePress(t.key)} onLayout={handleLayout(t.key)} style={styles.tab}>
                <Text style={[styles.label, { color: isActive ? colors.ink : colors.fg3, fontFamily: isActive ? fonts.medium : fonts.regular }]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
          <Animated.View style={[styles.indicator, { backgroundColor: colors.ink }, indicatorStyle]} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 1 },
  row: { flexDirection: 'row', position: 'relative' },
  tab: { paddingVertical: 10, paddingHorizontal: 14 },
  label: { fontSize: 13 },
  indicator: { position: 'absolute', bottom: 0, height: 1.5, borderRadius: 1 },
});
