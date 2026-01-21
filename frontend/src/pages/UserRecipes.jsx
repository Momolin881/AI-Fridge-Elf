/**
 * 使用者食譜庫頁面
 *
 * 顯示使用者收藏的食譜，支援分類篩選（收藏、常煮、黑白大廚 Pro）。
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Layout,
  Card,
  Button,
  Space,
  Spin,
  Empty,
  message,
  Typography,
  Tag,
  Tabs,
  List,
  Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  FireOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { getUserRecipes, deleteUserRecipe as deleteUserRecipeAPI } from '../services/api';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

function UserRecipes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'favorites';

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialCategory);
  const [recipes, setRecipes] = useState({
    favorites: [],
    常煮: [],
    pro: [],
  });

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      setLoading(true);

      // 載入所有分類的食譜
      const [favoritesData, frequentData, proData] = await Promise.all([
        getUserRecipes('favorites'),
        getUserRecipes('常煮'),
        getUserRecipes('pro'),
      ]);

      setRecipes({
        favorites: favoritesData,
        常煮: frequentData,
        pro: proData,
      });
    } catch (error) {
      console.error('載入食譜失敗:', error);
      message.error('載入食譜失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userRecipeId, category) => {
    try {
      await deleteUserRecipeAPI(userRecipeId);
      message.success('已刪除食譜');

      // 更新本地狀態
      setRecipes({
        ...recipes,
        [category]: recipes[category].filter((r) => r.id !== userRecipeId),
      });
    } catch (error) {
      console.error('刪除食譜失敗:', error);
      message.error('刪除食譜失敗，請稍後再試');
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case '簡單':
        return 'green';
      case '中等':
        return 'orange';
      case '困難':
        return 'red';
      default:
        return 'default';
    }
  };

  const renderRecipeCard = (userRecipe) => {
    const recipe = userRecipe.recipe;

    return (
      <Card
        key={userRecipe.id}
        style={{ marginBottom: 12 }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{recipe.name}</span>
            <Space>
              <Tag color={getDifficultyColor(recipe.difficulty)}>
                {recipe.difficulty}
              </Tag>
              <Popconfirm
                title="確定要刪除這個食譜嗎？"
                onConfirm={() => handleDelete(userRecipe.id, userRecipe.category)}
                okText="確定"
                cancelText="取消"
              >
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                />
              </Popconfirm>
            </Space>
          </div>
        }
        onClick={() => navigate(`/recipes/detail/${userRecipe.id}`, { state: { recipe } })}
        hoverable
      >
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          {/* 描述 */}
          {recipe.description && (
            <Paragraph
              ellipsis={{ rows: 2 }}
              style={{ marginBottom: 8 }}
            >
              {recipe.description}
            </Paragraph>
          )}

          {/* 資訊標籤 */}
          <Space wrap>
            {recipe.cooking_time && (
              <Tag icon={<ClockCircleOutlined />}>
                {recipe.cooking_time} 分鐘
              </Tag>
            )}
            {recipe.cuisine_type && (
              <Tag icon={<FireOutlined />}>
                {recipe.cuisine_type}
              </Tag>
            )}
          </Space>

          {/* 材料數量和步驟數量 */}
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              材料 {recipe.ingredients?.length || 0} 項 • 步驟 {recipe.steps?.length || 0} 個
            </Text>
          </div>
        </Space>
      </Card>
    );
  };

  const renderTabContent = (category) => {
    const categoryRecipes = recipes[category] || [];

    if (categoryRecipes.length === 0) {
      return (
        <Empty
          description={`尚無${category === 'favorites' ? '收藏' : category}食譜`}
          style={{ marginTop: 60 }}
        >
          <Button type="primary" onClick={() => navigate('/recipes/recommendations')}>
            去推薦頁面
          </Button>
        </Empty>
      );
    }

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {categoryRecipes.map(renderRecipeCard)}
      </Space>
    );
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Content style={{ padding: '16px' }}>
        {/* 標題 */}
        <div style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            style={{ marginBottom: 8 }}
          >
            返回
          </Button>
          <Title level={3}>我的食譜庫</Title>
        </div>

        {/* 載入中 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" tip="載入中..." />
          </div>
        ) : (
          /* 分類標籤頁 */
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type="card"
            size="large"
          >
            <TabPane
              tab={
                <span>
                  收藏
                  {recipes.favorites.length > 0 && (
                    <Tag
                      color="blue"
                      style={{ marginLeft: 8 }}
                    >
                      {recipes.favorites.length}
                    </Tag>
                  )}
                </span>
              }
              key="favorites"
            >
              {renderTabContent('favorites')}
            </TabPane>

            <TabPane
              tab={
                <span>
                  常煮
                  {recipes.常煮.length > 0 && (
                    <Tag
                      color="green"
                      style={{ marginLeft: 8 }}
                    >
                      {recipes.常煮.length}
                    </Tag>
                  )}
                </span>
              }
              key="常煮"
            >
              {renderTabContent('常煮')}
            </TabPane>

            <TabPane
              tab={
                <span>
                  黑白大廚 Pro
                  {recipes.pro.length > 0 && (
                    <Tag
                      color="gold"
                      style={{ marginLeft: 8 }}
                    >
                      {recipes.pro.length}
                    </Tag>
                  )}
                </span>
              }
              key="pro"
            >
              {renderTabContent('pro')}
            </TabPane>
          </Tabs>
        )}

        {/* 前往推薦頁面按鈕 */}
        {!loading && (
          <Button
            type="primary"
            onClick={() => navigate('/recipes/recommendations')}
            style={{ marginTop: 16, width: '100%' }}
            size="large"
          >
            發現新食譜
          </Button>
        )}
      </Content>
    </Layout>
  );
}

export default UserRecipes;
