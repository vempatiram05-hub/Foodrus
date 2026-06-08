import React from 'react';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import CategoryListScreen from './CategoryListScreen';

type Props = BottomTabScreenProps<any, any>;

const PongalScreen = (props: any) => (
  <CategoryListScreen
    {...props}
    route={{ ...props.route, params: { ...props.route?.params, category: "Pongal" } }}
  />
);

export default PongalScreen;