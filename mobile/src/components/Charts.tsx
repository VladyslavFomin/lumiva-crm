import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, G, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 200;
const PADDING = 20;

interface LineChartProps {
  data: number[];
  labels?: string[];
  color?: string;
  showGrid?: boolean;
  showArea?: boolean;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  labels,
  color,
  showGrid = true,
  showArea = true,
}) => {
  const { colors } = useTheme();
  const chartColor = color || colors.primary;
  const maxValue = Math.max(...data, 1);
  const minValue = Math.min(...data, 0);

  const chartWidth = CHART_WIDTH - PADDING * 2;
  const chartHeight = CHART_HEIGHT - PADDING * 2;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1 || 1)) * chartWidth + PADDING;
    const y = chartHeight - ((value - minValue) / (maxValue - minValue || 1)) * chartHeight + PADDING;
    return { x, y, value };
  });

  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const areaPath = `${pathData} L ${points[points.length - 1].x} ${chartHeight + PADDING} L ${PADDING} ${chartHeight + PADDING} Z`;

  const gridLines = 5;
  const gridYValues = Array.from({ length: gridLines }, (_, i) => {
    const value = minValue + ((maxValue - minValue) / (gridLines - 1)) * i;
    const y = chartHeight - ((value - minValue) / (maxValue - minValue || 1)) * chartHeight + PADDING;
    return { y, value };
  });

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        <Defs>
          <LinearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={chartColor} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={chartColor} stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        {showGrid &&
          gridYValues.map((grid, index) => (
            <G key={index}>
              <Line
                x1={PADDING}
                y1={grid.y}
                x2={CHART_WIDTH - PADDING}
                y2={grid.y}
                stroke={colors.borderLight}
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity={0.5}
              />
            </G>
          ))}

        {showArea && (
          <Path d={areaPath} fill="url(#areaGradient)" />
        )}

        <Path
          d={pathData}
          fill="none"
          stroke={chartColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, index) => (
          <Circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="4"
            fill={chartColor}
            stroke={colors.card}
            strokeWidth="2"
          />
        ))}
      </Svg>

      {labels && labels.length > 0 && (
        <View style={styles.labelsContainer}>
          {labels.map((label, index) => {
            const x = (index / (labels.length - 1 || 1)) * chartWidth + PADDING;
            return (
              <View key={index} style={[styles.label, { left: x - 20 }]}>
                <Text style={[styles.labelText, { color: colors.textTertiary }]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
}

export const BarChart: React.FC<BarChartProps> = ({ data, maxValue }) => {
  const { colors } = useTheme();
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);
  const barWidth = (CHART_WIDTH - PADDING * 2) / data.length - 8;

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        {data.map((item, index) => {
          const barHeight = (item.value / max) * (CHART_HEIGHT - PADDING * 2);
          const x = PADDING + index * (barWidth + 8) + 4;
          const y = CHART_HEIGHT - PADDING - barHeight;
          const barColor = item.color || colors.primary;

          return (
            <G key={index}>
              <Path
                d={`M ${x} ${y} L ${x + barWidth} ${y} L ${x + barWidth} ${CHART_HEIGHT - PADDING} L ${x} ${CHART_HEIGHT - PADDING} Z`}
                fill={barColor}
                opacity={0.8}
              />
              <Path
                d={`M ${x} ${y} L ${x + barWidth} ${y} L ${x + barWidth} ${y + 4} L ${x} ${y + 4} Z`}
                fill={barColor}
                opacity={1}
              />
            </G>
          );
        })}
      </Svg>

      <View style={styles.barLabelsContainer}>
        {data.map((item, index) => (
          <View key={index} style={[styles.barLabel, { width: barWidth }]}>
            <Text style={[styles.barLabelText, { color: colors.textTertiary }]} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={[styles.barValueText, { color: colors.text }]}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

interface PieChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
}

export const PieChart: React.FC<PieChartProps> = ({ data, size = 150 }) => {
  const { colors } = useTheme();
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const center = size / 2;
  const radius = size / 2 - 10;

  let currentAngle = -90;

  const paths = data.map((item) => {
    const percentage = item.value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startAngleRad);
    const y1 = center + radius * Math.sin(startAngleRad);
    const x2 = center + radius * Math.cos(endAngleRad);
    const y2 = center + radius * Math.sin(endAngleRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData = [
      `M ${center} ${center}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ');

    return { pathData, color: item.color, label: item.label, percentage };
  });

  return (
    <View style={styles.pieContainer}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths.map((path, index) => (
          <Path
            key={index}
            d={path.pathData}
            fill={path.color}
            stroke={colors.card}
            strokeWidth="2"
          />
        ))}
      </Svg>
      <View style={styles.pieLegend}>
        {paths.map((path, index) => (
          <View key={index} style={styles.pieLegendItem}>
            <View style={[styles.pieLegendColor, { backgroundColor: path.color }]} />
            <Text style={[styles.pieLegendLabel, { color: colors.text }]}>{path.label}</Text>
            <Text style={[styles.pieLegendValue, { color: colors.textSecondary }]}>
              {Math.round(path.percentage * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: { value: number; isPositive: boolean };
  color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color,
}) => {
  const { colors } = useTheme();
  const cardColor = color || colors.primary;

  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <View style={styles.statCardHeader}>
        <Text style={[styles.statCardTitle, { color: colors.textSecondary }]}>{title}</Text>
        {icon && (
          <View style={[styles.statCardIcon, { backgroundColor: cardColor + '15' }]}>
            <Text style={{ color: cardColor, fontSize: 20 }}>{icon}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.statCardValue, { color: colors.text }]}>{value}</Text>
      {subtitle && (
        <Text style={[styles.statCardSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      )}
      {trend && (
        <View style={styles.statCardTrend}>
          <Text
            style={[
              styles.statCardTrendText,
              { color: trend.isPositive ? colors.success : colors.error },
            ]}
          >
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  labelsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    position: 'relative',
    height: 20,
  },
  label: {
    position: 'absolute',
    width: 40,
    alignItems: 'center',
  },
  labelText: {
    fontSize: 10,
  },
  barLabelsContainer: {
    flexDirection: 'row',
    marginTop: 8,
    justifyContent: 'space-between',
    paddingHorizontal: PADDING,
  },
  barLabel: {
    alignItems: 'center',
  },
  barLabelText: {
    fontSize: 10,
    marginBottom: 4,
  },
  barValueText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pieContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  pieLegend: {
    marginTop: 16,
    width: '100%',
  },
  pieLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pieLegendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  pieLegendLabel: {
    flex: 1,
    fontSize: 14,
  },
  pieLegendValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardValue: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  statCardSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  statCardTrend: {
    marginTop: 8,
  },
  statCardTrendText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

