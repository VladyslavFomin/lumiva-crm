import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
  data: number[];
  height?: number;
  fill?: boolean;
}

/** RN port of `Spark` — small filled line chart used on Home/Marketing/Analytics hero cards. */
export const Sparkline: React.FC<Props> = ({ data, height = 56, fill = true }) => {
  const { colors } = useTheme();
  if (data.length < 2) return <View style={{ height }} />;
  const w = 300;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    height - ((v - min) / (max - min || 1)) * (height - 8) - 4,
  ]);
  const d = pts.map((p, i) => (i ? `L${p[0].toFixed(1)} ${p[1].toFixed(1)}` : `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`)).join(' ');
  const last = pts[pts.length - 1];

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      {fill && <Path d={`${d} L${w} ${height} L0 ${height} Z`} fill={colors.accentSoft} />}
      <Path d={d} stroke={colors.text} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={last[0]} cy={last[1]} r={3} fill={colors.text} />
    </Svg>
  );
};

const styles = StyleSheet.create({});
