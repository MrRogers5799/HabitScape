import { NavigationIndependentTree } from '@react-navigation/core';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from '@/src/navigation/RootNavigator';
import React from 'react';

export default function Index() {
  return (
    <NavigationIndependentTree>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </NavigationIndependentTree>
  );
}
