/**
 * 冰箱設定頁面
 *
 * 顯示冰箱資訊、容量使用率、管理分區。
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Button,
  message,
  Typography,
  Space,
  Spin,
  Progress,
  Statistic,
  List,
  Tag,
  Divider,
  Modal,
  Form,
  Input,
  InputNumber,
  Radio,
} from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { getFridges, getFridge, updateFridge, createCompartment, getFoodItems } from '../services/api';

const { Content } = Layout;
const { Title, Paragraph } = Typography;

function FridgeSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [fridges, setFridges] = useState([]);
  const [selectedFridge, setSelectedFridge] = useState(null);
  const [foodItems, setFoodItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [fridgeInfoModalVisible, setFridgeInfoModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [fridgeInfoForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // 載入冰箱和食材
      const [fridgesData, foodItemsData] = await Promise.all([
        getFridges(),
        getFoodItems(),
      ]);

      setFridges(fridgesData);
      setFoodItems(foodItemsData);

      // 載入第一個冰箱的詳細資訊
      if (fridgesData.length > 0) {
        const fridgeDetail = await getFridge(fridgesData[0].id);
        setSelectedFridge(fridgeDetail);
      }
    } catch (error) {
      console.error('載入資料失敗:', error);
      message.error('載入資料失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompartment = async (values) => {
    try {
      await createCompartment(selectedFridge.id, values);
      message.success('新增分區成功！');
      setModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error) {
      console.error('新增分區失敗:', error);
      message.error('新增分區失敗，請稍後再試');
    }
  };

  const handleUpdateFridgeInfo = async (values) => {
    try {
      await updateFridge(selectedFridge.id, values);
      message.success('更新冰箱資訊成功！');
      setFridgeInfoModalVisible(false);
      loadData();
    } catch (error) {
      console.error('更新冰箱資訊失敗:', error);
      message.error('更新失敗，請稍後再試');
    }
  };

  const openFridgeInfoModal = () => {
    fridgeInfoForm.setFieldsValue({
      model_name: selectedFridge?.model_name || '',
      total_capacity_liters: selectedFridge?.total_capacity_liters || 300,
    });
    setFridgeInfoModalVisible(true);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" tip="載入中..." />
      </div>
    );
  }

  if (fridges.length === 0) {
    return (
      <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <Content style={{ padding: '24px' }}>
          <Card>
            <Title level={4}>尚未設定冰箱</Title>
            <p>請先完成冰箱設定。</p>
            <Button type="primary" onClick={() => navigate('/setup')}>
              前往設定
            </Button>
          </Card>
        </Content>
      </Layout>
    );
  }

  // 計算容量使用率（混合模式）
  const DEFAULT_ITEM_VOLUME = 0.5; // 預設每件 0.5 公升
  const itemsWithVolume = foodItems.filter(item => item.volume_liters && item.volume_liters > 0);
  const itemsWithoutVolume = foodItems.filter(item => !item.volume_liters || item.volume_liters === 0);

  const volumeFromItems = itemsWithVolume.reduce((sum, item) => sum + item.volume_liters, 0);
  const estimatedVolume = itemsWithoutVolume.length * DEFAULT_ITEM_VOLUME;
  const totalVolume = volumeFromItems + estimatedVolume;

  const usagePercentage = selectedFridge
    ? Math.min(Math.round((totalVolume / selectedFridge.total_capacity_liters) * 100), 100)
    : 0;

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Content style={{ padding: '16px' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 標題 */}
          <Title level={3}>冰箱設定</Title>

          {/* 冰箱資訊 */}
          <Card
            title="冰箱資訊"
            extra={
              <Button type="link" icon={<EditOutlined />} onClick={openFridgeInfoModal}>
                編輯
              </Button>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <strong>型號：</strong>
                {selectedFridge?.model_name || '未設定'}
              </div>
              <div>
                <strong>總容量：</strong>
                {selectedFridge?.total_capacity_liters} 公升
              </div>
              <Divider />
              <div>
                <div style={{ marginBottom: 8 }}>
                  <strong>容量使用率</strong>
                </div>
                <Progress
                  percent={usagePercentage}
                  strokeColor={
                    usagePercentage > 80
                      ? '#ff4d4f'
                      : usagePercentage > 60
                        ? '#faad14'
                        : '#52c41a'
                  }
                  status="active"
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                  已使用約 <strong>{totalVolume.toFixed(1)}</strong> 公升
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: '#999', background: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                  📊 計算方式：
                  <br />
                  • 有設定體積的食材：{itemsWithVolume.length} 件（{volumeFromItems.toFixed(1)}L）
                  <br />
                  • 未設定體積的食材：{itemsWithoutVolume.length} 件 × 0.5L ≈ {estimatedVolume.toFixed(1)}L
                </div>
              </div>
            </Space>
          </Card>

          {/* 分區管理 */}
          {selectedFridge?.compartments && selectedFridge.compartments.length > 0 && (
            <Card
              title="分區管理"
              extra={
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  onClick={() => setModalVisible(true)}
                >
                  新增分區
                </Button>
              }
            >
              <List
                dataSource={selectedFridge.compartments}
                renderItem={(compartment) => {
                  const itemsInCompartment = foodItems.filter(
                    (item) => item.compartment_id === compartment.id
                  );

                  return (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            {compartment.name}
                            <Tag color={compartment.parent_type === '冷藏' ? 'blue' : 'cyan'}>
                              {compartment.parent_type}
                            </Tag>
                          </Space>
                        }
                        description={`${itemsInCompartment.length} 項食材`}
                      />
                    </List.Item>
                  );
                }}
              />
            </Card>
          )}

          {/* 統計資訊 */}
          <Card title="統計資訊">
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <Statistic title="總食材數" value={foodItems.length} suffix="項" />
              <Statistic
                title="冷藏"
                value={foodItems.filter((item) => item.storage_type === '冷藏').length}
                suffix="項"
              />
              <Statistic
                title="冷凍"
                value={foodItems.filter((item) => item.storage_type === '冷凍').length}
                suffix="項"
              />
            </div>
          </Card>

          {/* 返回首頁 */}
          <Button size="large" onClick={() => navigate('/')} block>
            返回首頁
          </Button>
        </Space>

        {/* 新增分區 Modal */}
        <Modal
          title="新增分區"
          open={modalVisible}
          onCancel={() => {
            setModalVisible(false);
            form.resetFields();
          }}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleAddCompartment}>
            <Form.Item
              label="分區名稱"
              name="name"
              rules={[{ required: true, message: '請輸入分區名稱' }]}
            >
              <Input placeholder="例如：冷藏上層、冷凍抽屜" size="large" />
            </Form.Item>

            <Form.Item
              label="父類別"
              name="parent_type"
              rules={[{ required: true, message: '請選擇父類別' }]}
            >
              <Radio.Group>
                <Radio value="冷藏">冷藏</Radio>
                <Radio value="冷凍">冷凍</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item label="容量（公升，可選）" name="capacity_liters">
              <InputNumber
                min={0}
                placeholder="選填"
                style={{ width: '100%' }}
                size="large"
                addonAfter="公升"
              />
            </Form.Item>

            <Form.Item>
              <Space style={{ width: '100%' }} size="middle">
                <Button
                  onClick={() => {
                    setModalVisible(false);
                    form.resetFields();
                  }}
                  style={{ flex: 1 }}
                >
                  取消
                </Button>
                <Button type="primary" htmlType="submit" style={{ flex: 1 }}>
                  新增
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* 編輯冰箱資訊 Modal */}
        <Modal
          title="編輯冰箱資訊"
          open={fridgeInfoModalVisible}
          onCancel={() => setFridgeInfoModalVisible(false)}
          footer={null}
        >
          <Form form={fridgeInfoForm} layout="vertical" onFinish={handleUpdateFridgeInfo}>
            <Form.Item
              label="型號"
              name="model_name"
            >
              <Input placeholder="例如：Panasonic NR-B582TG" size="large" />
            </Form.Item>

            <Form.Item
              label="總容量（公升）"
              name="total_capacity_liters"
              rules={[{ required: true, message: '請輸入總容量' }]}
            >
              <InputNumber
                min={1}
                max={2000}
                placeholder="300"
                style={{ width: '100%' }}
                size="large"
                addonAfter="公升"
              />
            </Form.Item>

            <Form.Item>
              <Space style={{ width: '100%' }} size="middle">
                <Button
                  onClick={() => setFridgeInfoModalVisible(false)}
                  style={{ flex: 1 }}
                >
                  取消
                </Button>
                <Button type="primary" htmlType="submit" style={{ flex: 1 }}>
                  儲存
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
}

export default FridgeSettings;
