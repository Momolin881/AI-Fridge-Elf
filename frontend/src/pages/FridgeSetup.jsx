/**
 * 冰箱初始化頁面（簡化版）
 *
 * 快速設定：選擇大小 → 選擇模式 → 開始使用
 */

import { useState } from 'react';
import { Layout, Card, Button, message, Typography, Space } from 'antd';
import { createFridge, createCompartment } from '../services/api';

const { Content } = Layout;
const { Title, Text } = Typography;

// 冰箱大小選項
const FRIDGE_SIZES = [
  { value: 150, label: '小型', description: '~150 公升', emoji: '🧊' },
  { value: 300, label: '中型', description: '~300 公升', emoji: '🧊🧊' },
  { value: 500, label: '大型', description: '~500 公升', emoji: '🧊🧊🧊' },
];

// 分區模式選項
const MODE_OPTIONS = [
  {
    value: 'simple',
    label: '簡單模式',
    description: '只分冷藏 / 冷凍',
    compartments: [],
  },
  {
    value: 'detailed',
    label: '細分模式',
    description: '冷藏上層 / 冷藏下層 / 冷凍',
    compartments: [
      { name: '冷藏上層', parent_type: '冷藏' },
      { name: '冷藏下層', parent_type: '冷藏' },
      { name: '冷凍', parent_type: '冷凍' },
    ],
  },
];

function FridgeSetup() {
  const [loading, setLoading] = useState(false);
  const [selectedSize, setSelectedSize] = useState(300); // 預設中型
  const [selectedMode, setSelectedMode] = useState('detailed'); // 預設細分模式

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // 建立冰箱
      const fridge = await createFridge({
        model_name: null,
        total_capacity_liters: selectedSize,
      });

      // 如果是細分模式，建立分區
      if (selectedMode === 'detailed') {
        const modeConfig = MODE_OPTIONS.find((m) => m.value === 'detailed');
        await Promise.all(
          modeConfig.compartments.map((comp) =>
            createCompartment(fridge.id, { ...comp, capacity_liters: null })
          )
        );
      }

      message.success('設定完成！開始使用吧 🎉');
      window.location.href = '/';
    } catch (error) {
      console.error('建立冰箱失敗:', error);
      message.error('建立失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Content style={{ padding: '24px', maxWidth: 480, margin: '0 auto' }}>
        <Card>
          <Title level={3} style={{ marginBottom: 8 }}>
            歡迎使用 AI Fridge Elf 🧝
          </Title>
          <Text type="secondary">快速設定你的冰箱，3 秒開始追蹤食材</Text>

          {/* 冰箱大小選擇 */}
          <div style={{ marginTop: 32 }}>
            <Text strong style={{ fontSize: 16 }}>
              你的冰箱大小？
            </Text>
            <Space
              direction="vertical"
              style={{ width: '100%', marginTop: 12 }}
              size="middle"
            >
              {FRIDGE_SIZES.map((size) => (
                <Card
                  key={size.value}
                  size="small"
                  hoverable
                  onClick={() => setSelectedSize(size.value)}
                  style={{
                    cursor: 'pointer',
                    borderColor: selectedSize === size.value ? '#1890ff' : '#d9d9d9',
                    borderWidth: selectedSize === size.value ? 2 : 1,
                    background: selectedSize === size.value ? '#e6f7ff' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <Text strong style={{ fontSize: 16 }}>
                        {size.emoji} {size.label}
                      </Text>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        {size.description}
                      </Text>
                    </div>
                    {selectedSize === size.value && (
                      <Text type="primary" strong>
                        ✓
                      </Text>
                    )}
                  </div>
                </Card>
              ))}
            </Space>
          </div>

          {/* 分區模式選擇 */}
          <div style={{ marginTop: 32 }}>
            <Text strong style={{ fontSize: 16 }}>
              分區方式？
            </Text>
            <Space
              direction="vertical"
              style={{ width: '100%', marginTop: 12 }}
              size="middle"
            >
              {MODE_OPTIONS.map((mode) => (
                <Card
                  key={mode.value}
                  size="small"
                  hoverable
                  onClick={() => setSelectedMode(mode.value)}
                  style={{
                    cursor: 'pointer',
                    borderColor: selectedMode === mode.value ? '#1890ff' : '#d9d9d9',
                    borderWidth: selectedMode === mode.value ? 2 : 1,
                    background: selectedMode === mode.value ? '#e6f7ff' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <Text strong style={{ fontSize: 16 }}>
                        {mode.label}
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {mode.description}
                      </Text>
                    </div>
                    {selectedMode === mode.value && (
                      <Text type="primary" strong>
                        ✓
                      </Text>
                    )}
                  </div>
                </Card>
              ))}
            </Space>
          </div>

          {/* 開始使用按鈕 */}
          <Button
            type="primary"
            size="large"
            block
            loading={loading}
            onClick={handleSubmit}
            style={{ marginTop: 32, height: 48 }}
          >
            開始使用
          </Button>

          <Text
            type="secondary"
            style={{ display: 'block', textAlign: 'center', marginTop: 16, fontSize: 12 }}
          >
            之後可在設定中調整
          </Text>
        </Card>
      </Content>
    </Layout>
  );
}

export default FridgeSetup;
