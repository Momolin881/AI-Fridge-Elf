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
import { PlusOutlined, SearchOutlined, ExclamationCircleOutlined, CalendarOutlined, WarningOutlined, ClockCircleOutlined, RightOutlined, CopyOutlined, DownloadOutlined, UploadOutlined, TeamOutlined, SettingOutlined, BellOutlined, BulbOutlined, BookOutlined } from '@ant-design/icons';
import { getFoodItems, getFridges, deleteFoodItem, createFridgeInvite, exportFridge, importFridge, getFridgeMembers, updateMemberRole, removeMember, getUserRecipes } from '../services/api';
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
  const [filter, setFilter] = useState('all'); // all, 冷藏, 冷凍, expired, archived
  const [searchText, setSearchText] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [recipeCategoryCounts, setRecipeCategoryCounts] = useState({ favorites: 0, '常煮': 0, pro: 0 });

  useEffect(() => {
    loadData();
  }, [filter]);

  useEffect(() => {
    // 套用篩選和搜尋
    let result = foodItems;

    // 篩選類型（archived 的資料已經在 loadData 中處理過了）
    if (filter === '冷藏') {
      result = result.filter((item) => item.storage_type === '冷藏');
    } else if (filter === '冷凍') {
      result = result.filter((item) => item.storage_type === '冷凍');
    } else if (filter === 'expired') {
      result = result.filter((item) => item.is_expired);
    }
    // filter === 'archived' 或 'all' 時不做額外篩選

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

      // 根據篩選器決定要載入的狀態
      const statusParam = filter === 'archived' ? 'archived' : 'active';

      // 載入冰箱和食材
      const [fridgesData, itemsData] = await Promise.all([
        getFridges(),
        getFoodItems({ status: statusParam }),
      ]);

      setFridges(fridgesData);
      setFoodItems(itemsData);

      // 載入成員清單
      if (fridgesData.length > 0) {
        try {
          const membersData = await getFridgeMembers(fridgesData[0].id);
          setMembers(membersData);
          // 檢查當前使用者是否為 owner (第一個 owner 角色的成員)
          const ownerMember = membersData.find(m => m.role === 'owner');
          // 簡化判斷：如果成員列表存在且有 owner，假設當前用戶就是 owner
          // 實際應用中應該比對 LIFF user_id
          setIsOwner(ownerMember ? true : false);
        } catch (e) {
          console.log('載入成員清單失敗:', e);
          // 如果載入失敗，預設為 owner（因為可能是第一次使用）
          setIsOwner(true);
        }

        // 載入食譜分類數量
        try {
          const [favoritesRecipes, changzhuRecipes, proRecipes] = await Promise.all([
            getUserRecipes('favorites'),
            getUserRecipes('常煮'),
            getUserRecipes('pro'),
          ]);
          setRecipeCategoryCounts({
            favorites: favoritesRecipes?.length || 0,
            '常煮': changzhuRecipes?.length || 0,
            pro: proRecipes?.length || 0,
          });
        } catch (e) {
          console.log('載入食譜分類失敗:', e);
        }
      } else {
        setIsOwner(true); // 沒有冰箱時預設為 owner
      }
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
        {/* 1. 新增食材區塊 */}
        <Title level={5} style={{ marginBottom: 8, color: '#666' }}>
          1.新增食材
        </Title>
        <Card
          hoverable
          onClick={() => {
            if (fridges.length === 0) {
              navigate('/setup');
            } else {
              navigate('/add');
            }
          }}
          style={{
            marginBottom: 16,
            cursor: 'pointer',
            border: '2px dashed #1890ff',
            background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
          }}
        >
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <span style={{ fontSize: 32, color: '#1890ff' }}>+ 📸</span>
          </div>
        </Card>

        {/* 2. 我的冰箱 */}
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={5} style={{ marginBottom: 0, color: '#666' }}>
            2.我的冰箱
          </Title>
          <Button
            type="link"
            style={{ fontSize: 14, padding: 0 }}
            onClick={() => setShareModalVisible(true)}
          >
            （僅管理員）一鍵分享/寄送邀請
          </Button>
        </div>

        {/* 統計卡片 */}
        <Card style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* 冰箱模式標籤 */}
            {fridges.length > 0 && (
              <div style={{ paddingBottom: 12, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                <Tag color={fridges[0].compartment_mode === 'detailed' ? 'purple' : 'default'}>
                  {fridges[0].compartment_mode === 'detailed' ? '🗂️ 細分模式' : '📦 簡易模式'}
                </Tag>
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

            {/* 引導文字 */}
            {(stats.expired > 0 || stats.expiringSoon > 0) && (
              <div style={{
                background: '#fff7e6',
                border: '1px solid #ffd591',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                color: '#ad6800'
              }}>
                請盡快處理過期，點進按「已處理」，讓看板歸零
              </div>
            )}

            {/* 功能按鈕 */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
              <Button
                icon={<SettingOutlined />}
                onClick={() => navigate('/settings')}
              >
                冰箱設定
              </Button>
              <Button
                icon={<BellOutlined />}
                onClick={() => navigate('/settings/notifications')}
              >
                通知設定
              </Button>
              <Button
                icon={<DownloadOutlined />}
                loading={exportLoading}
                onClick={async () => {
                  if (fridges.length === 0) return;
                  try {
                    setExportLoading(true);
                    const data = await exportFridge(fridges[0].id);
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `fridge-backup-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    message.success('匯出成功');
                  } catch (error) {
                    console.error('匯出失敗:', error);
                    message.error('匯出失敗');
                  } finally {
                    setExportLoading(false);
                  }
                }}
              >
                匯出
              </Button>
              <Button
                icon={<UploadOutlined />}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const data = JSON.parse(text);
                      if (fridges.length === 0) return;
                      await importFridge(fridges[0].id, data, false);
                      message.success('匯入成功');
                      loadData();
                    } catch (error) {
                      console.error('匯入失敗:', error);
                      message.error('匯入失敗，請檢查檔案格式');
                    }
                  };
                  input.click();
                }}
              >
                匯入
              </Button>
              <Button
                icon={<BulbOutlined />}
                onClick={() => navigate('/recipes/recommendations')}
              >
                食譜推薦
              </Button>
              {/* 食譜分類按鈕 - 只顯示有食譜的分類 */}
              {recipeCategoryCounts.favorites > 0 && (
                <Button
                  icon={<BookOutlined />}
                  onClick={() => navigate('/recipes?category=favorites')}
                >
                  收藏 ({recipeCategoryCounts.favorites})
                </Button>
              )}
              {recipeCategoryCounts['常煮'] > 0 && (
                <Button
                  icon={<BookOutlined />}
                  onClick={() => navigate('/recipes?category=常煮')}
                >
                  常煮 ({recipeCategoryCounts['常煮']})
                </Button>
              )}
              {recipeCategoryCounts.pro > 0 && (
                <Button
                  icon={<BookOutlined />}
                  onClick={() => navigate('/recipes?category=pro')}
                >
                  Pro ({recipeCategoryCounts.pro})
                </Button>
              )}
            </div>

            {/* 成員清單 */}
            {members.length > 0 && (
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TeamOutlined style={{ color: '#666' }} />
                    <span style={{ fontSize: 13, color: '#666' }}>冰箱成員 ({members.length})</span>
                  </div>
                  {isOwner && (
                    <span
                      style={{ fontSize: 12, color: '#1890ff', cursor: 'pointer' }}
                      onClick={() => setMemberModalVisible(true)}
                    >
                      編輯
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: -8 }}>
                  {members.slice(0, 5).map((member, idx) => (
                    <div
                      key={member.id}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        border: member.role === 'owner' ? '2px solid #faad14' : '2px solid #fff',
                        overflow: 'hidden',
                        marginLeft: idx > 0 ? -8 : 0,
                        background: '#1890ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 12,
                      }}
                      title={`${member.display_name} (${member.role === 'owner' ? '管理員' : member.role === 'editor' ? '共享者' : '檢視者'})`}
                    >
                      {member.picture_url ? (
                        <img src={member.picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        member.display_name?.[0] || '?'
                      )}
                    </div>
                  ))}
                  {members.length > 5 && (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        border: '2px solid #fff',
                        marginLeft: -8,
                        background: '#d9d9d9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#666',
                        fontSize: 11,
                      }}
                    >
                      +{members.length - 5}
                    </div>
                  )}
                </div>
              </div>
            )}
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
            <Option value="archived">📦 已處理（歷史）</Option>
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
                ? '尚無食材，點選上方卡片新增'
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

        {/* 分享邀請 Modal */}
        <Modal
          title="分享冰箱"
          open={shareModalVisible}
          onCancel={() => {
            setShareModalVisible(false);
            setInviteCode(null);
          }}
          footer={null}
        >
          {!inviteCode ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ marginBottom: 16, color: '#666' }}>
                產生邀請連結，讓朋友也能查看或編輯這個冰箱的食材
              </p>
              <Button
                type="primary"
                size="large"
                loading={inviteLoading}
                onClick={async () => {
                  if (fridges.length === 0) return;
                  try {
                    setInviteLoading(true);
                    const result = await createFridgeInvite(fridges[0].id, {
                      default_role: 'editor',
                      expires_days: 7,
                    });
                    setInviteCode(result.invite_code);
                  } catch (error) {
                    console.error('產生邀請碼失敗:', error);
                    message.error('產生邀請碼失敗');
                  } finally {
                    setInviteLoading(false);
                  }
                }}
              >
                產生邀請連結
              </Button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: '#666', marginBottom: 8 }}>邀請碼</p>
              <p style={{ fontSize: 32, fontWeight: 'bold', letterSpacing: 6, marginBottom: 8 }}>
                {inviteCode}
              </p>
              <p style={{ color: '#999', fontSize: 12, marginBottom: 20 }}>有效期限：7 天</p>
              <Button
                type="primary"
                icon={<CopyOutlined />}
                size="large"
                block
                onClick={() => {
                  const liffId = import.meta.env.VITE_LIFF_ID || '2008810800-TjjioAMA';
                  const inviteLink = `https://liff.line.me/${liffId}?join=${inviteCode}`;
                  navigator.clipboard.writeText(inviteLink);
                  message.success('邀請連結已複製');
                }}
              >
                複製邀請連結
              </Button>
              <p style={{ color: '#999', fontSize: 12, marginTop: 16 }}>
                將連結分享給朋友，點擊後即可加入
              </p>
            </div>
          )}
        </Modal>

        {/* 成員管理 Modal */}
        <Modal
          title="管理冰箱成員"
          open={memberModalVisible}
          onCancel={() => setMemberModalVisible(false)}
          footer={null}
        >
          <List
            dataSource={members}
            renderItem={(member) => (
              <List.Item
                actions={
                  member.role !== 'owner' ? [
                    <Select
                      key="role"
                      value={member.role}
                      size="small"
                      style={{ width: 90 }}
                      onChange={async (newRole) => {
                        if (fridges.length === 0) return;
                        try {
                          await updateMemberRole(fridges[0].id, member.id, { role: newRole });
                          message.success('權限已更新');
                          // 重新載入成員
                          const membersData = await getFridgeMembers(fridges[0].id);
                          setMembers(membersData);
                        } catch (error) {
                          console.error('更新權限失敗:', error);
                          message.error('更新權限失敗');
                        }
                      }}
                    >
                      <Option value="editor">共享者</Option>
                      <Option value="viewer">檢視者</Option>
                    </Select>,
                    <Button
                      key="delete"
                      type="text"
                      danger
                      size="small"
                      onClick={async () => {
                        if (fridges.length === 0) return;
                        Modal.confirm({
                          title: '確認移除',
                          content: `確定要移除「${member.display_name}」嗎？`,
                          okText: '移除',
                          okType: 'danger',
                          cancelText: '取消',
                          onOk: async () => {
                            try {
                              await removeMember(fridges[0].id, member.id);
                              message.success('成員已移除');
                              const membersData = await getFridgeMembers(fridges[0].id);
                              setMembers(membersData);
                            } catch (error) {
                              console.error('移除成員失敗:', error);
                              message.error('移除成員失敗');
                            }
                          },
                        });
                      }}
                    >
                      移除
                    </Button>,
                  ] : [
                    <Tag key="owner" color="gold">管理員</Tag>
                  ]
                }
              >
                <List.Item.Meta
                  avatar={
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: '#1890ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                      }}
                    >
                      {member.picture_url ? (
                        <img src={member.picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        member.display_name?.[0] || '?'
                      )}
                    </div>
                  }
                  title={member.display_name}
                />
              </List.Item>
            )}
          />
        </Modal>
      </Content>
    </Layout>
  );
}

export default Home;
