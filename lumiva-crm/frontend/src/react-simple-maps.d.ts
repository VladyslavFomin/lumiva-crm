declare module 'react-simple-maps' {
  import type { CSSProperties, FC, ReactNode } from 'react';

  /** Минимальная форма объекта географии из topojson (достаточно для choropleth). */
  export type RsmGeography = {
    rsmKey: string;
    properties: Record<string, unknown>;
  };

  export const ComposableMap: FC<{
    children?: ReactNode;
    projection?: string;
    projectionConfig?: { scale?: number; center?: [number, number] };
    width?: number;
    height?: number;
    className?: string;
  }>;

  export const Geographies: FC<{
    geography: string;
    children: (o: { geographies: RsmGeography[] }) => ReactNode;
  }>;

  export const Geography: FC<{
    geography: RsmGeography;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    style?: {
      default?: CSSProperties;
      hover?: CSSProperties;
      pressed?: CSSProperties;
    };
  }>;
}
