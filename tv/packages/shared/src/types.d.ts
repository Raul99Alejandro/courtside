declare module 'react-native-pixel-perfect' {
  export function create(designResolution: { width: number; height: number }): (size: number) => number;
}
