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
  Tag,
  Button,
  Popover,
} from 'antd';
import { PlusOutlined, SearchOutlined, ExclamationCircleOutlined, CalendarOutlined, WarningOutlined, ClockCircleOutlined, RightOutlined } from '@ant-design/icons';
import { getFoodItems, getFridges, deleteFoodItem } from '../services/api';
import { FoodItemCard, VersionFooter, ExpenseCalendarModal } from '../components';

const { Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [foodItems, setFoodItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [fridges, setFridges] = useState([]);
  const [filter, setFilter] = useState('all'); // all, 冷藏, 冷凍, expired
  const [searchText, setSearchText] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);

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

  // 分區排序順序（新版 3 分區）
  const compartmentOrder = ['冷藏上層', '冷藏下層', '冷凍'];

  // 分組和排序食材
  const groupedItems = () => {
    const isDetailedMode = fridges.length > 0 && fridges[0].compartment_mode === 'detailed';

    if (!isDetailedMode) {
      // 簡易模式：按儲存類型分組（🧊 冷藏 / ❄️ 冷凍）
      const groups = {
        '🧊 冷藏': [],
        '❄️ 冷凍': [],
      };

      filteredItems.forEach((item) => {
        if (item.storage_type === '冷凍') {
          groups['❄️ 冷凍'].push(item);
        } else {
          groups['🧊 冷藏'].push(item);
        }
      });

      // 移除空分組
      Object.keys(groups).forEach((key) => {
        if (groups[key].length === 0) {
          delete groups[key];
        }
      });

      return groups;
    }

    // 細分模式：按分區分組
    const groups = {};
    filteredItems.forEach((item) => {
      const compartment = item.compartment || '未分類';
      if (!groups[compartment]) {
        groups[compartment] = [];
      }
      groups[compartment].push(item);
    });

    // 按照預定順序排序分區
    const sortedGroups = {};
    compartmentOrder.forEach((compartment) => {
      if (groups[compartment]) {
        sortedGroups[compartment] = groups[compartment];
      }
    });

    // 加入未在預定順序中的分區
    Object.keys(groups).forEach((compartment) => {
      if (!compartmentOrder.includes(compartment)) {
        sortedGroups[compartment] = groups[compartment];
      }
    });

    return sortedGroups;
  };

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
            {/* 冰箱資訊 */}
            {fridges.length > 0 && (
              <div style={{ paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: '#666' }}>
                    {fridges[0].model_name || '我的冰箱'}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Tag color={fridges[0].compartment_mode === 'detailed' ? 'purple' : 'default'}>
                      {fridges[0].compartment_mode === 'detailed' ? '🗂️ 細分模式' : '📦 簡易模式'}
                    </Tag>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <Statistic title="總數" value={stats.total} suffix="項" />
              <Statistic title="🧊 冷藏" value={stats.冷藏} suffix="項" />
              <Statistic title="❄️ 冷凍" value={stats.冷凍} suffix="項" />
            </div>
            {/* 即將過期 / 已過期 - 大字體可點擊區塊 */}
            <div style={{ display: 'flex', gap: 12 }}>
              {/* 即將過期 */}
              <Popover
                title={<span style={{ fontSize: 16 }}><ClockCircleOutlined /> 即將過期食材</span>}
                trigger="click"
                placement="bottom"
                content={
                  <div style={{ maxHeight: 300, overflow: 'auto', minWidth: 200 }}>
                    {foodItems
                      .filter((item) => !item.is_expired && item.days_until_expiry !== null && item.days_until_expiry <= 3)
                      .length === 0 ? (
                      <Text type="secondary">目前沒有即將過期的食材</Text>
                    ) : (
                      <List
                        size="small"
                        dataSource={foodItems.filter(
                          (item) => !item.is_expired && item.days_until_expiry !== null && item.days_until_expiry <= 3
                        )}
                        renderItem={(item) => (
                          <List.Item
                            style={{ cursor: 'pointer', padding: '8px 4px' }}
                            onClick={() => navigate(`/edit/${item.id}`)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                              <div>
                                <Text strong style={{ fontSize: 15 }}>{item.name}</Text>
                                <Tag color="orange" style={{ marginLeft: 8 }}>
                                  {item.days_until_expiry === 0 ? '今天' : `${item.days_until_expiry} 天`}
                                </Tag>
                              </div>
                              <RightOutlined style={{ color: '#999' }} />
                            </div>
                          </List.Item>
                        )}
                      />
                    )}
                  </div>
                }
              >
                <Card
                  hoverable
                  size="small"
                  style={{
                    flex: 1,
                    background: stats.expiringSoon > 0 ? 'linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%)' : '#fafafa',
                    borderColor: stats.expiringSoon > 0 ? '#ffc53d' : '#d9d9d9',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <ClockCircleOutlined style={{ fontSize: 24, color: '#faad14', marginBottom: 4 }} />
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: stats.expiringSoon > 0 ? '#d48806' : '#999' }}>
                      {stats.expiringSoon}
                    </div>
                    <div style={{ fontSize: 14, color: '#666' }}>即將過期</div>
                  </div>
                </Card>
              </Popover>

              {/* 已過期 */}
              <Popover
                title={<span style={{ fontSize: 16 }}><WarningOutlined style={{ color: '#ff4d4f' }} /> 已過期食材</span>}
                trigger="click"
                placement="bottom"
                content={
                  <div style={{ maxHeight: 300, overflow: 'auto', minWidth: 200 }}>
                    {foodItems.filter((item) => item.is_expired).length === 0 ? (
                      <Text type="secondary">目前沒有過期的食材</Text>
                    ) : (
                      <List
                        size="small"
                        dataSource={foodItems.filter((item) => item.is_expired)}
                        renderItem={(item) => (
                          <List.Item
                            style={{ cursor: 'pointer', padding: '8px 4px' }}
                            onClick={() => navigate(`/edit/${item.id}`)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                              <div>
                                <Text strong style={{ fontSize: 15 }}>{item.name}</Text>
                                <Tag color="red" style={{ marginLeft: 8 }}>
                                  過期 {Math.abs(item.days_until_expiry)} 天
                                </Tag>
                              </div>
                              <RightOutlined style={{ color: '#999' }} />
                            </div>
                          </List.Item>
                        )}
                      />
                    )}
                  </div>
                }
              >
                <Card
                  hoverable
                  size="small"
                  style={{
                    flex: 1,
                    background: stats.expired > 0 ? 'linear-gradient(135deg, #fff2f0 0%, #ffccc7 100%)' : '#fafafa',
                    borderColor: stats.expired > 0 ? '#ff7875' : '#d9d9d9',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <WarningOutlined style={{ fontSize: 24, color: '#ff4d4f', marginBottom: 4 }} />
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: stats.expired > 0 ? '#cf1322' : '#999' }}>
                      {stats.expired}
                    </div>
                    <div style={{ fontSize: 14, color: '#666' }}>已過期</div>
                  </div>
                </Card>
              </Popover>
            </div>

            {/* 風險進度條 */}
            <div>
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
                format={(percent) => <span style={{ fontSize: 12 }}>{percent}% 需注意</span>}
              />
            </div>
          </Space>
        </Card>

        {/* 消費日曆按鈕 */}
        <Button
          type="primary"
          icon={<CalendarOutlined />}
          onClick={() => setCalendarVisible(true)}
          style={{
            width: '100%',
            marginBottom: 16,
            height: 44,
            fontSize: 16,
            background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
            border: 'none',
            boxShadow: '0 2px 8px rgba(82, 196, 26, 0.3)',
          }}
        >
          查看消費月曆
        </Button>

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
          (() => {
            const groups = groupedItems();
            const isDetailedMode = fridges.length > 0 && fridges[0].compartment_mode === 'detailed';

            return (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                {Object.entries(groups).map(([groupName, items]) => (
                  <div key={groupName}>
                    {/* 分組標題 */}
                    <Title
                      level={5}
                      style={{
                        marginBottom: 12,
                        color: isDetailedMode ? '#722ed1' : '#1890ff',
                        fontSize: isDetailedMode ? '16px' : '18px',
                      }}
                    >
                      {isDetailedMode ? `📍 ${groupName}` : groupName}
                    </Title>

                    {/* 食材列表 */}
                    <List
                      dataSource={items}
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
                  </div>
                ))}
              </Space>
            );
          })()
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

        {/* 消費月曆 Modal */}
        <ExpenseCalendarModal
          visible={calendarVisible}
          onClose={() => setCalendarVisible(false)}
        />
      </Content>
    </Layout>
  );
}

export default Home;
