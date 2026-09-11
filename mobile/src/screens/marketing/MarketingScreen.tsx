import React, { useState } from 'react';
import { View, StatusBar } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { TrafficScreen } from './TrafficScreen';
import { CampaignsScreen } from './CampaignsScreen';
import { UtmsScreen } from './UtmsScreen';
import { SegmentsScreen } from './SegmentsScreen';
import { AuraBackground } from '../../components/glass';
import { MgHeader, HeaderIconButton, ThemeChip, Segmented } from '../../components/mg';

type Tab = 'traffic' | 'campaigns' | 'utm' | 'audience';

export const MarketingScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [tab, setTab] = useState<Tab>(route.params?.initialTab || 'traffic');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AuraBackground />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <MgHeader
        title="Маркетинг"
        sub="Трафик и кампании"
        right={<>
          <HeaderIconButton icon="mail-outline" onPress={() => navigation.navigate('EmailTemplates')} />
          <ThemeChip />
        </>}
      >
        <View style={{ marginTop: 11 }}>
          <Segmented
            options={[
              { key: 'traffic', label: 'Трафик' },
              { key: 'campaigns', label: 'Кампании' },
              { key: 'utm', label: 'UTM' },
              { key: 'audience', label: 'Аудитории' },
            ]}
            activeKey={tab}
            onChange={(k) => setTab(k as Tab)}
          />
        </View>
      </MgHeader>

      <View style={{ flex: 1 }}>
        {tab === 'traffic' && <TrafficScreen />}
        {tab === 'campaigns' && <CampaignsScreen />}
        {tab === 'utm' && <UtmsScreen />}
        {tab === 'audience' && <SegmentsScreen />}
      </View>
    </View>
  );
};
