import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PinchGestureHandler, State, PinchGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { useTheme, fonts, spacing } from '../../theme/ThemeContext';

interface Props {
  label: string;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  children: React.ReactNode;
}

/** Wraps a chart with a period label + zoom in/out chips, and lets a real two-finger pinch drive the same zoom (pinch out narrows the date window, pinch in widens it back). */
export const ZoomableChart: React.FC<Props> = ({ label, canZoomIn, canZoomOut, onZoomIn, onZoomOut, children }) => {
  const { colors } = useTheme();

  const onPinchStateChange = (e: PinchGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      const scale = e.nativeEvent.scale;
      if (scale > 1.25) onZoomIn();
      else if (scale < 0.8) onZoomOut();
    }
  };

  return (
    <View>
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.textTertiary }]}>ЗА {label.toUpperCase()}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onZoomOut} disabled={!canZoomOut} style={styles.btn} hitSlop={8}>
          <Ionicons name="remove-circle-outline" size={20} color={canZoomOut ? colors.text : colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onZoomIn} disabled={!canZoomIn} style={styles.btn} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={20} color={canZoomIn ? colors.text : colors.textTertiary} />
        </TouchableOpacity>
      </View>
      <PinchGestureHandler onHandlerStateChange={onPinchStateChange}>
        <View>{children}</View>
      </PinchGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  label: { fontSize: 10.5, fontFamily: fonts.mono, letterSpacing: 0.6 },
  btn: { padding: 2, marginLeft: spacing.xs },
});
