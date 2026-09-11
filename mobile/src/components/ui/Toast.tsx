import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useTheme, fonts, radius, spacing } from '../../theme/ThemeContext';

interface ToastPayload {
  id: number;
  message: string;
  variant?: 'default' | 'error' | 'success';
  actionLabel?: string;
  onAction?: () => void;
}

type Listener = (payload: ToastPayload) => void;
let listeners: Listener[] = [];
let seq = 0;

/** Fire-and-forget toast, with an optional inline action (e.g. "Undo" after a delete). */
export function showToast(message: string, opts?: Omit<ToastPayload, 'id' | 'message'>) {
  const payload: ToastPayload = { id: ++seq, message, ...opts };
  listeners.forEach((l) => l(payload));
}

/** Mount once near the app root. Renders whatever `showToast()` was last called with. */
export const ToastHost: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastPayload | null>(null);

  useEffect(() => {
    const listener: Listener = (payload) => setToast(payload);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  const accent = toast.variant === 'error' ? colors.error : toast.variant === 'success' ? colors.success : colors.onInk;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      exiting={FadeOutDown.duration(150)}
      style={[styles.wrap, { bottom: insets.bottom + 16, backgroundColor: colors.ink }]}
    >
      <Text style={[styles.msg, { color: colors.onInk }]} numberOfLines={2}>
        {toast.message}
      </Text>
      {toast.actionLabel && toast.onAction && (
        <TouchableOpacity
          onPress={() => {
            toast.onAction?.();
            setToast(null);
          }}
          hitSlop={8}
        >
          <Text style={[styles.action, { color: accent }]}>{toast.actionLabel}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.xl,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 8,
    zIndex: 999,
  },
  msg: { flex: 1, fontSize: 13, fontFamily: fonts.medium },
  action: { fontSize: 12, fontFamily: fonts.semibold, textTransform: 'uppercase' },
});
