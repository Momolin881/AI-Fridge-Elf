/**
 * 首頁 - 食材清單頁面
 *
 * 顯示所有食材，支援篩選（冷藏/冷凍/過期）和搜尋。
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout,
  List,
  FloatButton,
  Select,
  Input,
  Spin,
  Empty,
  message,
  Typography,
  Space,
  Progress,
  Card,
  Statistic,
  Modal,
} from 'antd';
import { PlusOutlined, SearchOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { getFoodItems, getFridges, deleteFoodItem } from '../services/api';
import { FoodItemCard, VersionFooter } from '../components';

const { Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [foodItems, setFoodItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [fridges, setFridges] = useState([]);
  const [filter, setFilter] = useState('all'); // all, 冷藏, 冷凍, expired
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // 套用篩選和搜尋
    let result = foodItems;

    // 篩選類型
    if (filter === '冷藏') {
      result = result.filter((item) => item.storage_type === '冷藏');
    } else if (filter === '冷凍') {
      result = result.filter((item) => item.storage_type === '冷凍');
    } else if (filter === 'expired') {
      result = result.filter((item) => item.is_expired);
    }

    // 搜尋
    if (searchText) {
      result = result.filter((item) =>
        item.name.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    setFilteredItems(result);
  }, [foodItems, filter, searchText]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 載入冰箱和食材
      const [fridgesData, itemsData] = await Promise.all([
        getFridges(),
        getFoodItems(),
      ]);

      setFridges(fridgesData);
      setFoodItems(itemsData);
    } catch (error) {
      console.error('載入資料失敗:', error);
      message.error('載入資料失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 處理編輯食材
  const handleEdit = (item) => {
    navigate(`/edit/${item.id}`);
  };

  // 處理刪除食材
  const handleDelete = (item) => {
    Modal.confirm({
      title: '確認刪除',
      icon: <ExclamationCircleOutlined />,
      content: `確定要刪除「${item.name}」嗎？此操作無法復原。`,
      okText: '刪除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteFoodItem(item.id);
          message.success('食材已刪除');
          await loadData(); // 重新載入資料
        } catch (error) {
          console.error('刪除失敗:', error);
          message.error('刪除失敗，請稍後再試');
        }
      },
    });
  };

  // 計算統計數據
  const stats = {
    total: foodItems.length,
    冷藏: foodItems.filter((item) => item.storage_type === '冷藏').length,
    冷凍: foodItems.filter((item) => item.storage_type === '冷凍').length,
    expired: foodItems.filter((item) => item.is_expired).length,
    expiringSoon: foodItems.filter(
      (item) => !item.is_expired && item.days_until_expiry !== null && item.days_until_expiry <= 3
    ).length,
  };

  // 計算即將過期比例（用於進度條）
  const expiringPercentage = stats.total > 0
    ? Math.round(((stats.expired + stats.expiringSoon) / stats.total) * 100)
    : 0;

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Content style={{ padding: '16px' }}>
        {/* 標題 */}
        <Title level={3} style={{ marginBottom: 16 }}>
          我的冰箱
        </Title>

        {/* 統計卡片 */}
        <Card style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <Statistic title="總數" value={stats.total} suffix="項" />
              <Statistic title="冷藏" value={stats.冷藏} suffix="項" />
              <Statistic title="冷凍" value={stats.冷凍} suffix="項" />
            </div>
            <div>
              <div style={{ marginBottom: 8 }}>
                <span>即將過期: {stats.expiringSoon} 項</span>
                <span style={{ marginLeft: 16, color: '#ff4d4f' }}>
                  已過期: {stats.expired} 項
                </span>
              </div>
              <Progress
                percent={expiringPercentage}
                strokeColor={
                  expiringPercentage > 50
                    ? '#ff4d4f'
                    : expiringPercentage > 20
                    ? '#faad14'
                    : '#52c41a'
                }
                status="active"
              />
            </div>
          </Space>
        </Card>

        {/* 篩選和搜尋 */}
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size="middle">
          <Select
            value={filter}
            onChange={setFilter}
            style={{ width: '100%' }}
            size="large"
          >
            <Option value="all">全部食材</Option>
            <Option value="冷藏">冷藏</Option>
            <Option value="冷凍">冷凍</Option>
            <Option value="expired">已過期</Option>
          </Select>

          <Input
            placeholder="搜尋食材名稱..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            size="large"
            allowClear
          />
        </Space>

        {/* 食材清單 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" tip="載入中..." />
          </div>
        ) : filteredItems.length === 0 ? (
          <Empty
            description={
              foodItems.length === 0
                ? '尚無食材，點選右下角「+」新增'
                : '找不到符合條件的食材'
            }
            style={{ marginTop: 60 }}
          />
        ) : (
          <List
            dataSource={filteredItems}
            renderItem={(item) => (
              <FoodItemCard
                key={item.id}
                item={item}
                onClick={() => navigate(`/edit/${item.id}`)}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
          />
        )}

        {/* 新增按鈕 */}
        <FloatButton
          icon={<PlusOutlined />}
          type="primary"
          style={{ right: 24, bottom: 24 }}
          onClick={() => {
            // 檢查是否有冰箱
            if (fridges.length === 0) {
              navigate('/setup');
            } else {
              navigate('/add');
            }
          }}
        />

        {/* 版本資訊 */}
        <VersionFooter />
      </Content>
    </Layout>
  );
}

export default Home;
