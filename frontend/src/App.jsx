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
import { getFridges, joinFridgeByCode } from './services/api';

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

// 在 LIFF 初始化之前先保存 URL 參數（因為 LIFF 可能會清除它們）
const getInitialJoinCode = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const joinCode = urlParams.get('join');
  if (joinCode) {
    console.log('頁面載入時發現邀請碼:', joinCode);
    // 保存到 sessionStorage，避免 LIFF 初始化後丟失
    sessionStorage.setItem('pendingJoinCode', joinCode);
  }
  return joinCode;
};

// 頁面載入時立即檢查
const initialJoinCode = getInitialJoinCode();

function App() {
  const [liffReady, setLiffReady] = useState(false);
  const [liffError, setLiffError] = useState(null);
  const [hasFridge, setHasFridge] = useState(true);
  const [checkingFridge, setCheckingFridge] = useState(true);
  const [joiningFridge, setJoiningFridge] = useState(false);

  // 處理邀請碼加入冰箱
  const handleJoinByInviteCode = async () => {
    // 優先從 sessionStorage 讀取（LIFF 初始化可能會清除 URL 參數）
    let joinCode = sessionStorage.getItem('pendingJoinCode');

    // 如果 sessionStorage 沒有，再從 URL 讀取
    if (!joinCode) {
      const urlParams = new URLSearchParams(window.location.search);
      joinCode = urlParams.get('join');
    }

    if (!joinCode) {
      return false;
    }

    console.log('處理邀請碼:', joinCode);
    setJoiningFridge(true);

    try {
      const result = await joinFridgeByCode(joinCode);
      message.success(`成功加入冰箱！角色：${result.role === 'editor' ? '共享者' : '檢視者'}`);

      // 清除暫存的邀請碼
      sessionStorage.removeItem('pendingJoinCode');

      // 清除 URL 中的 join 參數，避免重複加入
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      return true;
    } catch (error) {
      console.error('加入冰箱失敗:', error);
      const errorMsg = error.response?.data?.detail || '加入冰箱失敗';
      message.error(errorMsg);

      // 清除暫存的邀請碼
      sessionStorage.removeItem('pendingJoinCode');

      // 清除 URL 中的 join 參數
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      return false;
    } finally {
      setJoiningFridge(false);
    }
  };

  useEffect(() => {
    // 初始化 LIFF SDK
    const init = async () => {
      try {
        const isReady = await initializeLiff();

        if (isReady) {
          setLiffReady(true);

          // 先處理邀請碼加入
          await handleJoinByInviteCode();

          // 再檢查是否已設定冰箱
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

  // 初始化中或檢查冰箱設定中或加入冰箱中
  if (!liffReady || checkingFridge || joiningFridge) {
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
