import React from 'react';
import CategoryListScreen from './CategoryListScreen';

const OmeletteScreen = (props: any) => (
  <CategoryListScreen
    {...props}
    route={{ ...props.route, params: { ...props.route?.params, category: 'Omelette' } }}
  />
);

export default OmeletteScreen;