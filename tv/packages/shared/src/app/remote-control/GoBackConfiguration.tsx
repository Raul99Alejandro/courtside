import React, { useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import RemoteControlManager from './RemoteControlManager';
import { SupportedKeys } from './SupportedKeys';

export const GoBackConfiguration: React.FC = () => {
  const navigation = useNavigation();

  const handleBackPress = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  useEffect(() => {
    const remoteControlListener = (pressedKey: SupportedKeys) => {
      if (pressedKey === SupportedKeys.Back) {
        handleBackPress();
      }
    };

    RemoteControlManager.addKeydownListener(remoteControlListener);
    return () => RemoteControlManager.removeKeydownListener(remoteControlListener);
  }, [handleBackPress]);

  return null;
};
