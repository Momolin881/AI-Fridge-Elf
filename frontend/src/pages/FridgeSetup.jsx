/**
 * 冰箱初始化頁面
 *
 * 首次使用時引導使用者設定冰箱資訊。
 * 支援簡單模式（冷藏/冷凍）和細分模式（自訂分區）。
 */

import { useState } from 'react';
import {
  Layout,
  Card,
  Form,
  Input,
  InputNumber,
  Radio,
  Button,
  message,
  Typography,
  Space,
  Divider,
} from 'antd';
import { createFridge, createCompartment } from '../services/api';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

function FridgeSetup() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('simple'); // simple or detailed

  const handleSubmit = async (values) => {
    try {
      setLoading(true);

      // 建立冰箱
      const fridgeData = {
        model_name: values.model_name || null,
        total_capacity_liters: values.total_capacity_liters,
      };

      const fridge = await createFridge(fridgeData);

      // 如果是細分模式，建立預設分區
      if (mode === 'detailed') {
        const defaultCompartments = [
          { name: '冷藏上層', parent_type: '冷藏', capacity_liters: null },
          { name: '冷藏中層', parent_type: '冷藏', capacity_liters: null },
          { name: '冷藏下層', parent_type: '冷藏', capacity_liters: null },
          { name: '冷凍上層', parent_type: '冷凍', capacity_liters: null },
          { name: '冷凍下層', parent_type: '冷凍', capacity_liters: null },
        ];

        // 批次建立分區
        await Promise.all(
          defaultCompartments.map((comp) => createCompartment(fridge.id, comp))
        );
      }

      message.success('冰箱設定完成！');
      // 強制重新載入頁面，讓 App.jsx 重新檢查冰箱狀態
      window.location.href = '/';
    } catch (error) {
      console.error('建立冰箱失敗:', error);
      message.error('建立冰箱失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Content style={{ padding: '24px' }}>
        <Card>
          <Title level={3}>歡迎使用 AI Fridge Elf</Title>
          <Paragraph type="secondary">
            讓我們先設定你的冰箱資訊，以便更精準地管理食材。
          </Paragraph>

          <Divider />

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              total_capacity_liters: 300,
              mode: 'simple',
            }}
          >
            {/* 冰箱型號 */}
            <Form.Item
              label="冰箱型號（可選）"
              name="model_name"
              help="例如：Samsung 雙門冰箱、Panasonic 三門冰箱"
            >
              <Input placeholder="請輸入冰箱型號" size="large" />
            </Form.Item>

            {/* 總容量 */}
            <Form.Item
              label="總容量（公升）"
              name="total_capacity_liters"
              rules={[
                { required: true, message: '請輸入總容量' },
                { type: 'number', min: 1, message: '容量必須大於 0' },
              ]}
              help="可參考冰箱說明書，或估算一個大約值"
            >
              <InputNumber
                placeholder="例如：300"
                style={{ width: '100%' }}
                size="large"
                addonAfter="公升"
              />
            </Form.Item>

            {/* 分區模式 */}
            <Form.Item
              label="分區模式"
              name="mode"
              help="簡單模式：只區分冷藏和冷凍 | 細分模式：可自訂多個分區（如上層、中層、下層）"
            >
              <Radio.Group
                onChange={(e) => setMode(e.target.value)}
                value={mode}
                size="large"
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Radio value="simple">
                    <div>
                      <div style={{ fontWeight: 500 }}>簡單模式</div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        適合小型冰箱或不需細分的使用者
                      </div>
                    </div>
                  </Radio>
                  <Radio value="detailed">
                    <div>
                      <div style={{ fontWeight: 500 }}>細分模式</div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        自動建立 5 個預設分區（冷藏上/中/下層、冷凍上/下層）
                      </div>
                    </div>
                  </Radio>
                </Space>
              </Radio.Group>
            </Form.Item>

            {/* 提交按鈕 */}
            <Form.Item style={{ marginTop: 32 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="large"
                block
              >
                完成設定
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Content>
    </Layout>
  );
}

export default FridgeSetup;
