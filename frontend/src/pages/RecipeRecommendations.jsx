/**
 * 食譜推薦頁面
 *
 * 根據現有食材推薦適合的食譜。
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  List,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  FireOutlined,
  HeartOutlined,
  HeartFilled,
} from '@ant-design/icons';
import { getFoodItems, getRecipeRecommendations, createUserRecipe } from '../services/api';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

function RecipeRecommendations() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [recommending, setRecommending] = useState(false);
  const [foodItems, setFoodItems] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // 載入食材
      const items = await getFoodItems();
      setFoodItems(items);

      // 如果有食材，自動推薦
      if (items.length > 0) {
        await getRecommendations();
      }
    } catch (error) {
      console.error('載入資料失敗:', error);
      message.error('載入資料失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const getRecommendations = async (itemIds = []) => {
    try {
      setRecommending(true);
      const recipes = await getRecipeRecommendations(itemIds);
      setRecommendations(recipes);

      if (recipes.length === 0) {
        message.info('目前沒有適合的食譜推薦');
      }
    } catch (error) {
      console.error('推薦食譜失敗:', error);
      message.error('推薦食譜失敗，請稍後再試');
    } finally {
      setRecommending(false);
    }
  };

  const handleAddToFavorites = async (recipe) => {
    try {
      await createUserRecipe(recipe, 'favorites');
      message.success('已加入收藏');
      setFavoriteIds(new Set([...favoriteIds, recipe.name]));
    } catch (error) {
      console.error('加入收藏失敗:', error);
      message.error('加入收藏失敗，請稍後再試');
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

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <Content style={{ padding: '16px' }}>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" tip="載入中..." />
          </div>
        </Content>
      </Layout>
    );
  }

  if (foodItems.length === 0) {
    return (
      <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <Content style={{ padding: '16px' }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            style={{ marginBottom: 16 }}
          >
            返回
          </Button>
          <Empty
            description="尚無食材，請先新增食材"
            style={{ marginTop: 60 }}
          >
            <Button type="primary" onClick={() => navigate('/add')}>
              新增食材
            </Button>
          </Empty>
        </Content>
      </Layout>
    );
  }

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
          <Title level={3} style={{ marginBottom: 8 }}>
            食譜推薦
          </Title>
          <Text type="secondary">
            根據您的 {foodItems.length} 項食材推薦適合的食譜
          </Text>
        </div>

        {/* 重新推薦按鈕 */}
        <Button
          type="primary"
          onClick={() => getRecommendations()}
          loading={recommending}
          style={{ marginBottom: 16, width: '100%' }}
          size="large"
        >
          重新推薦
        </Button>

        {/* 推薦結果 */}
        {recommending ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" tip="AI 推薦中..." />
          </div>
        ) : recommendations.length === 0 ? (
          <Empty description="尚無推薦食譜" style={{ marginTop: 60 }} />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {recommendations.map((recipe, index) => (
              <Card
                key={index}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{recipe.name}</span>
                    <Button
                      type="text"
                      icon={
                        favoriteIds.has(recipe.name) ? (
                          <HeartFilled style={{ color: '#ff4d4f' }} />
                        ) : (
                          <HeartOutlined />
                        )
                      }
                      onClick={() => handleAddToFavorites(recipe)}
                      disabled={favoriteIds.has(recipe.name)}
                    />
                  </div>
                }
                extra={
                  <Tag color={getDifficultyColor(recipe.difficulty)}>
                    {recipe.difficulty}
                  </Tag>
                }
                onClick={() => navigate(`/recipes/${index}`, { state: { recipe } })}
                hoverable
              >
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {/* 描述 */}
                  <Paragraph
                    ellipsis={{ rows: 2 }}
                    style={{ marginBottom: 8 }}
                  >
                    {recipe.description}
                  </Paragraph>

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

                  <Divider style={{ margin: '12px 0' }} />

                  {/* 符合的食材 */}
                  {recipe.matched_ingredients && recipe.matched_ingredients.length > 0 && (
                    <div>
                      <Text strong style={{ fontSize: 12 }}>
                        符合的食材：
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        <Space wrap size={[4, 4]}>
                          {recipe.matched_ingredients.map((ingredient, i) => (
                            <Tag key={i} color="green" style={{ fontSize: 11 }}>
                              {ingredient}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    </div>
                  )}

                  {/* 缺少的食材 */}
                  {recipe.missing_ingredients && recipe.missing_ingredients.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <Text strong style={{ fontSize: 12 }}>
                        需要採買：
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        <Space wrap size={[4, 4]}>
                          {recipe.missing_ingredients.map((ingredient, i) => (
                            <Tag key={i} color="orange" style={{ fontSize: 11 }}>
                              {ingredient}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    </div>
                  )}
                </Space>
              </Card>
            ))}
          </Space>
        )}
      </Content>
    </Layout>
  );
}

export default RecipeRecommendations;
