import React from 'react';
import CategoryListScreen from './CategoryListScreen';

const ChineseScreen = (props: any) => (
  <CategoryListScreen
    {...props}
    route={{ ...props.route, params: { ...props.route?.params, category: 'Chinese' } }}
  />
);

export default ChineseScreen;