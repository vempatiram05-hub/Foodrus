import React from 'react';
import CategoryListScreen from './CategoryListScreen';

const ShakesScreen = (props: any) => (
  <CategoryListScreen
    {...props}
    route={{ ...props.route, params: { ...props.route?.params, category: 'Shakes' } }}
  />
);

export default ShakesScreen;