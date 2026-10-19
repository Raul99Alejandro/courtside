type PopNav = { navigate: (name: string) => void; popTo?: (name: string) => void };

/**
 * Back to a screen already in the stack. React Navigation 7 has popTo; the Vega ports (@amazon-devices/react-navigation__*
 * "7.0.x") are aliases of v6, which has no popTo but whose navigate() to a screen already in the stack pops back to it.
 */
export function popTo(navigation: PopNav, name: string) {
  if (typeof navigation.popTo === 'function') navigation.popTo(name);
  else navigation.navigate(name);
}
