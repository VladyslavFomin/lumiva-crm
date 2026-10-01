declare module 'react-simple-maps' {
  import type { CSSProperties, FC, MouseEvent, ReactNode } from 'react';

  /** Минимальная форма объекта географии из topojson (достаточно для choropleth). */
  export type RsmGeography = {
    rsmKey: string;
    id?: string;
    properties: Record<string, unknown>;
    geometry?: unknown;
  };

  export const ComposableMap: FC<{
    children?: ReactNode;
    projection?: string;
    projectionConfig?: { scale?: number; center?: [number, number]; rotate?: [number, number, number] };
    width?: number;
    height?: number;
    className?: string;
    style?: CSSProperties;
  }>;

  export const ZoomableGroup: FC<{
    children?: ReactNode;
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    onMoveEnd?: (position: { coordinates: [number, number]; zoom: number }) => void;
  }>;

  export const Marker: FC<{
    coordinates: [number, number];
    children?: ReactNode;
  }>;

  export const Geographies: FC<{
    /** URL topojson или уже загруженный объект topology */
    geography: string | Record<string, unknown>;
    children: (o: { geographies: RsmGeography[] }) => ReactNode;
  }>;

  export const Geography: FC<{
    geography: RsmGeography;
    onMouseEnter?: (event: MouseEvent) => void;
    onMouseMove?: (event: MouseEvent) => void;
    onMouseLeave?: (event: MouseEvent) => void;
    onClick?: (event: MouseEvent) => void;
    style?: {
      default?: CSSProperties;
      hover?: CSSProperties;
      pressed?: CSSProperties;
    };
  }>;
}
