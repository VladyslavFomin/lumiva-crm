import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Three soft radial-gradient blobs behind glass surfaces — RN port of `.mg-app::before`
 * in styles/mobile-glass.css. Mount once per screen root (behind content, absolute-fill),
 * with the screen's own root background set to `transparent` so it shows through.
 */
export const AuraBackground: React.FC = () => {
  const { isDark } = useTheme();
  const { width, height } = useWindowDimensions();

  const blobs = isDark
    ? [
        { cx: 0.08, cy: 0.04, r: 0.62, color: '#3f6a7e', stop: 0.85 },
        { cx: 1.0, cy: 0.26, r: 0.62, color: '#2e6a5c', stop: 0.7 },
        { cx: 0.74, cy: 1.0, r: 0.66, color: '#4a3f70', stop: 0.7 },
      ]
    : [
        { cx: 0.12, cy: 0.08, r: 0.58, color: '#bfe0ee', stop: 0.95 },
        { cx: 0.96, cy: 0.22, r: 0.6, color: '#c3ecd9', stop: 0.85 },
        { cx: 0.7, cy: 0.96, r: 0.64, color: '#d6cdef', stop: 0.75 },
      ];

  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <Defs>
        {blobs.map((b, i) => (
          <RadialGradient key={i} id={`aura-${i}`} cx={b.cx} cy={b.cy} r={b.r}>
            <Stop offset="0" stopColor={b.color} stopOpacity={b.stop} />
            <Stop offset="1" stopColor={b.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {blobs.map((_, i) => (
        <Rect key={i} x={0} y={0} width={width} height={height} fill={`url(#aura-${i})`} />
      ))}
    </Svg>
  );
};
