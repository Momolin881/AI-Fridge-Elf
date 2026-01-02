/**
 * App 主元件
 *
 * 應用程式的根元件，負責路由設定和 LIFF 初始化。
 */

import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin, message } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import { initializeLiff } from './liff';
import { Home, FridgeSetup, AddFoodItem, EditFoodItem, FridgeSettings, NotificationSettings, BudgetManagement, RecipeRecommendations, RecipeDetail, UserRecipes } from './pages';
import { getFridges } from './services/api';

// 載入元件
const LoadingPage = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    flexDirection: 'column',
    gap: '20px'
  }}>
    <Spin size="large" />
    <p>初始化 LIFF...</p>
  </div>
);

function App() {
  const [liffReady, setLiffReady] = useState(false);
  const [liffError, setLiffError] = useState(null);
  const [hasFridge, setHasFridge] = useState(true);
  const [checkingFridge, setCheckingFridge] = useState(true);

  useEffect(() => {
    // 初始化 LIFF SDK
    const init = async () => {
      try {
        const isReady = await initializeLiff();

        if (isReady) {
          setLiffReady(true);
          // 檢查是否已設定冰箱
          checkFridgeSetup();
        } else {
          // 登入中，等待重新導向
          console.log('Redirecting to LINE login...');
        }
      } catch (error) {
        console.error('LIFF init error:', error);
        setLiffError(error.message || 'LIFF 初始化失敗');
        message.error('LIFF 初始化失敗，請稍後再試');
      }
    };

    init();
  }, []);

  const checkFridgeSetup = async () => {
    try {
      const fridges = await getFridges();
      setHasFridge(fridges.length > 0);
    } catch (error) {
      console.error('檢查冰箱設定失敗:', error);
      // 如果 API 失敗，假設未設定
      setHasFridge(false);
    } finally {
      setCheckingFridge(false);
    }
  };

  // 顯示錯誤訊息
  if (liffError) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '10px',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h2>😔 發生錯誤</h2>
        <p>{liffError}</p>
        <button onClick={() => window.location.reload()}>重新載入</button>
      </div>
    );
  }

  // 初始化中或檢查冰箱設定中
  if (!liffReady || checkingFridge) {
    return <LoadingPage />;
  }

  // LIFF 已就緒，顯示應用
  return (
    <ConfigProvider locale={zhTW}>
      <Router>
        <Routes>
          {/* 首頁 */}
          <Route
            path="/"
            element={hasFridge ? <Home /> : <Navigate to="/setup" replace />}
          />

          {/* 冰箱設定 */}
          <Route path="/setup" element={<FridgeSetup />} />

          {/* 新增食材 */}
          <Route path="/add" element={<AddFoodItem />} />

          {/* 編輯食材 */}
          <Route path="/edit/:id" element={<EditFoodItem />} />

          {/* 冰箱設定頁面 */}
          <Route path="/settings" element={<FridgeSettings />} />

          {/* 通知設定頁面 */}
          <Route path="/settings/notifications" element={<NotificationSettings />} />

          {/* 預算控管頁面 */}
          <Route path="/budget" element={<BudgetManagement />} />

          {/* 食譜推薦 */}
          <Route path="/recipes/recommendations" element={<RecipeRecommendations />} />

          {/* 食譜詳情 */}
          <Route path="/recipes/:id" element={<RecipeDetail />} />

          {/* 使用者食譜庫 */}
          <Route path="/recipes" element={<UserRecipes />} />

          {/* 404 重新導向到首頁 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;
