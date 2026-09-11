import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProductsListScreen } from './ProductsListScreen';
import { ProductDetailScreen } from './ProductDetailScreen';
import { ProductCreateScreen } from './ProductCreateScreen';
import { ProductCategoriesScreen } from './ProductCategoriesScreen';
import { ProductsAnalyticsScreen } from './ProductsAnalyticsScreen';

export type ProductsStackParamList = {
  ProductsList: undefined;
  ProductDetail: { id: string };
  ProductCreate: undefined;
  ProductCategories: undefined;
  ProductsAnalytics: undefined;
};

const Stack = createNativeStackNavigator<ProductsStackParamList>();

export const ProductsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProductsList" component={ProductsListScreen} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
    <Stack.Screen name="ProductCreate" component={ProductCreateScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    <Stack.Screen name="ProductCategories" component={ProductCategoriesScreen} />
    <Stack.Screen name="ProductsAnalytics" component={ProductsAnalyticsScreen} />
  </Stack.Navigator>
);
