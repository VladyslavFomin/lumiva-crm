import React, { forwardRef, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import BottomSheetLib, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useTheme } from '../../theme/ThemeContext';
import { GlassCard } from '../glass';

interface Props {
  snapPoints?: (string | number)[];
  children: React.ReactNode;
  onDismiss?: () => void;
}

export type AppBottomSheetRef = React.ComponentRef<typeof BottomSheetLib>;

/**
 * Bottom sheet — the mobile stand-in for the web app's centered `.modal-panel`.
 * Used for filters, field edits, and any form that would be a popup/modal on desktop.
 */
export const AppBottomSheet = forwardRef<AppBottomSheetRef, Props>(({ snapPoints, children, onDismiss }, ref) => {
  const { colors, isDark } = useTheme();
  const points = useMemo(() => snapPoints ?? ['50%', '85%'], [snapPoints]);

  return (
    <BottomSheetLib
      ref={ref}
      index={-1}
      snapPoints={points}
      enablePanDownToClose
      onClose={onDismiss}
      // `<div className="mg-sheet g">` in the design — same `.g` glass surface as any card/the tab
      // bar (gradient + border + top highlight), just with the sheet's own 28px radius
      // (`.mg-sheet{border-radius:28px}` overrides `.g`'s 22px later in the stylesheet).
      backgroundComponent={() => <GlassCard variant="g" style={styles.bg} />}
      handleIndicatorStyle={{ backgroundColor: colors.textTertiary, width: 36 }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={isDark ? 0.6 : 0.35} pressBehavior="close" />
      )}
    >
      <BottomSheetView style={styles.content}>{children}</BottomSheetView>
    </BottomSheetLib>
  );
});

const styles = StyleSheet.create({
  bg: { ...StyleSheet.absoluteFillObject, borderRadius: 28 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
});
