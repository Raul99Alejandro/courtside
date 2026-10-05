import { useCallback } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { SpatialNavigationRoot, DefaultFocus } from 'react-tv-space-navigation';
import { DrawerActions, useIsFocused, useNavigation } from '@react-navigation/native';
import { Direction } from '@bam.tech/lrud';
import { layerFor, newViewer } from '@courtside/core';
import { scaledPixels } from '../hooks/useScale';
import { colors, safeZones } from '../theme';
import FocusablePressable from '../components/FocusablePressable';
import { useMenuContext } from '../components/MenuContext';
import { getOpenDrawerDirection } from '../utils/rtl';

/** Smoke screen: proves navigation, focus and the pure core all work on the TV stack. */
export function describeLayer(level: 'beginner' | 'fan' | 'expert'): string {
  return layerFor(newViewer('Guest', level), []);
}

export default function HelloCourtside() {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const { isOpen: isMenuOpen, toggleMenu } = useMenuContext();

  const onDirectionHandledWithoutMovement = useCallback(
    (movement: Direction) => {
      if (movement === getOpenDrawerDirection()) {
        navigation.dispatch(DrawerActions.openDrawer());
        toggleMenu(true);
      }
    },
    [toggleMenu, navigation],
  );

  return (
    <SpatialNavigationRoot
      isActive={isFocused && !isMenuOpen}
      onDirectionHandledWithoutMovement={onDirectionHandledWithoutMovement}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Courtside</Text>
        <Text style={styles.body}>
          A beginner sees the {describeLayer('beginner')} layer. An expert sees the {describeLayer('expert')} layer.
        </Text>
        <DefaultFocus>
          <FocusablePressable text="Start watching" onSelect={() => undefined} />
        </DefaultFocus>
      </View>
    </SpatialNavigationRoot>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    paddingHorizontal: scaledPixels(safeZones.titleSafe.horizontal),
    paddingVertical: scaledPixels(safeZones.titleSafe.vertical),
    justifyContent: 'center',
    gap: scaledPixels(32),
  },
  title: { fontSize: scaledPixels(96), fontWeight: 'bold', color: colors.text },
  body: { fontSize: scaledPixels(36), color: colors.textSecondary },
});
