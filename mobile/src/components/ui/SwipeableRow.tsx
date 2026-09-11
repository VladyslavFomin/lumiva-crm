import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { SharedValue, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fonts } from '../../theme/ThemeContext';

export interface SwipeAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}

interface Props {
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  children: React.ReactNode;
}

const ACTION_WIDTH = 84;

function ActionPanel({ action, progress, side }: { action: SwipeAction; progress: SharedValue<number>; side: 'left' | 'right' }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.6, 1], 'clamp') }],
    opacity: interpolate(progress.value, [0, 0.6, 1], [0, 0.8, 1], 'clamp'),
  }));
  return (
    <View style={[styles.actionWrap, { backgroundColor: action.color, alignItems: side === 'left' ? 'flex-start' : 'flex-end' }]}>
      <Animated.View style={[styles.actionInner, style]}>
        <Ionicons name={action.icon} size={18} color="#fff" />
        <Text style={styles.actionLabel}>{action.label}</Text>
      </Animated.View>
    </View>
  );
}

/** Swipe-to-act row — replaces the web app's hover-only row actions with a native gesture. */
export const SwipeableRow: React.FC<Props> = ({ leftAction, rightAction, children }) => {
  const swipeRef = React.useRef<React.ComponentRef<typeof Swipeable>>(null);

  const runAction = (action?: SwipeAction) => {
    if (!action) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    swipeRef.current?.close();
    action.onPress();
  };

  return (
    <Swipeable
      ref={swipeRef}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={ACTION_WIDTH / 2}
      rightThreshold={ACTION_WIDTH / 2}
      renderLeftActions={
        leftAction
          ? (progress) => (
              <Animated.View style={{ width: ACTION_WIDTH }}>
                <ActionPanel action={leftAction} progress={progress} side="left" />
              </Animated.View>
            )
          : undefined
      }
      renderRightActions={
        rightAction
          ? (progress) => (
              <Animated.View style={{ width: ACTION_WIDTH }}>
                <ActionPanel action={rightAction} progress={progress} side="right" />
              </Animated.View>
            )
          : undefined
      }
      onSwipeableOpen={(direction) => runAction(direction === 'left' ? leftAction : rightAction)}
    >
      {children}
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  actionWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 14 },
  actionInner: { alignItems: 'center', gap: 3 },
  actionLabel: { color: '#fff', fontSize: 10, fontFamily: fonts.semibold },
});
