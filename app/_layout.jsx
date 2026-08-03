import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import { LayoutGrid, Zap, Wrench, Users, BookOpen } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#00E5FF',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'War Room',
          tabBarIcon: ({ color, size }) => <LayoutGrid size={size || 18} color={color} />,
        }}
      />
      <Tabs.Screen
        name="actions"
        options={{
          title: 'AI Radar',
          tabBarIcon: ({ color, size }) => <Zap size={size || 18} color={color} />,
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: 'Scripts',
          tabBarIcon: ({ color, size }) => <BookOpen size={size || 18} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: 'Leads',
          tabBarIcon: ({ color, size }) => <Users size={size || 18} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: 'Tools',
          tabBarIcon: ({ color, size }) => <Wrench size={size || 18} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0A0E1A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
});