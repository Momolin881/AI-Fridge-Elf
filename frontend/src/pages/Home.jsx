/**
 * 首頁 - 食材清單頁面
 *
 * 顯示所有食材，支援篩選（冷藏/冷凍/過期）和搜尋。
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Card,
  Statistic,
  Modal,
  Tag,
  Button,
  Popover,
} from 'antd';
import { PlusOutlined, SearchOutlined, CalendarOutlined, WarningOutlined, ClockCircleOutlined, RightOutlined, CopyOutlined, DownloadOutlined, UploadOutlined, TeamOutlined, SettingOutlined, BellOutlined, BulbOutlined, BookOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { getFoodItems, getFridges, archiveFoodItem, createFridgeInvite, exportFridge, importFridge, getFridgeMembers, updateMemberRole, removeMember, getUserRecipes, getOnboardingProgress, shouldShowOnboardingTutorial, markCelebrationSent, completeOnboardingTask } from '../services/api';
import { FoodItemCard, VersionFooter, ExpenseCalendarModal, OnboardingCard, AchievementCelebration } from '../components';

const { Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [disposalModalVisible, setDisposalModalVisible] = useState(false);
  const [selectedItemForDisposal, setSelectedItemForDisposal] = useState(null);
  const [disposalLoading, setDisposalLoading] = useState(false);
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [recipeCategoryCounts, setRecipeCategoryCounts] = useState({ favorites: 0, '常煮': 0, pro: 0 });
  
  // 新手引導相關狀態
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingProgress, setOnboardingProgress] = useState(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [skipFocusReload, setSkipFocusReload] = useState(false);
  const [autoDetectRunning, setAutoDetectRunning] = useState(false);
  const [recentlyUpdated, setRecentlyUpdated] = useState(false);

  // localStorage 常數
  const ONBOARDING_STORAGE_KEY = 'ai_fridge_elf_onboarding_progress';
  const ONBOARDING_DISMISSED_KEY = 'ai_fridge_elf_onboarding_dismissed';

  // 保存進度到 localStorage
  const saveProgressToStorage = (progress) => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({
        ...progress,
        lastUpdated: Date.now()
      }));
      console.log('💾 進度已保存到 localStorage');
    } catch (error) {
      console.log('保存到 localStorage 失敗:', error);
    }
  };

  // 從 localStorage 讀取進度
  const getProgressFromStorage = () => {
    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        // 檢查是否為最近的資料（24小時內）
        if (data.lastUpdated && (Date.now() - data.lastUpdated) < 24 * 60 * 60 * 1000) {
          console.log('📱 從 localStorage 讀取進度:', data);
          return data;
        }
      }
    } catch (error) {
      console.log('從 localStorage 讀取失敗:', error);
    }
    return null;
  };

  useEffect(() => {
    loadData();
  }, [filter]);

  // 分離新手引導載入邏輯，避免與 filter 變化混合
  useEffect(() => {
    if (!recentlyUpdated) {
      console.log('🔄 filter 變化，載入新手進度');
      loadOnboardingData();
    } else {
      console.log('🔒 filter 變化但跳過載入新手進度，因為剛剛更新過');
    }
  }, [filter, recentlyUpdated]);

  // 當資料載入完成後，觸發自動檢測（僅在首次載入或新增食材時）
  useEffect(() => {
    if (foodItems.length > 0 && onboardingProgress && !onboardingProgress.is_completed && !autoDetectRunning && !recentlyUpdated) {
      console.log('📊 觸發自動檢測條件滿足，延遲500ms後執行');
      // 延遲檢測，避免頻繁觸發
      const timer = setTimeout(() => {
        autoDetectTaskCompletion();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [foodItems.length, onboardingProgress?.is_completed, autoDetectRunning, recentlyUpdated]);

  // 監聽導航狀態變化，從 AddFoodItem 返回時使用傳遞的進度資料
  useEffect(() => {
    if (location.state?.refreshOnboarding) {
      console.log('🔄 從 AddFoodItem 返回，檢查傳遞的狀態');
      console.log('📨 location.state:', location.state);
      console.log('📊 location.state.onboardingProgress:', location.state.onboardingProgress);
      
      // 如果有傳遞進度資料，直接使用，否則重新載入
      if (location.state.onboardingProgress) {
        console.log('📋 使用傳遞的進度資料:', location.state.onboardingProgress);
        setOnboardingProgress(location.state.onboardingProgress);
        setShowOnboarding(true);
        
        // 設定標記，5秒內禁用焦點重新載入
        setSkipFocusReload(true);
        setTimeout(() => {
          setSkipFocusReload(false);
          console.log('🔓 重新啟用焦點重新載入');
        }, 5000);
      } else {
        console.log('🔄 沒有傳遞進度資料，重新載入');
        if (!recentlyUpdated) {
          loadOnboardingData();
        } else {
          console.log('🔒 跳過重新載入（剛更新過進度）');
        }
      }
      
      // 清除狀態避免重複觸發
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // 監聽頁面焦點和可見性變化，重新載入新手進度
  useEffect(() => {
    const handleFocus = () => {
      if (skipFocusReload) {
        console.log('🔒 跳過焦點重新載入（剛使用傳遞的資料）');
        return;
      }
      if (recentlyUpdated) {
        console.log('🔒 跳過焦點重新載入（剛更新過進度）');
        return;
      }
      console.log('頁面重新獲得焦點，重新載入新手進度');
      loadOnboardingData();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (skipFocusReload) {
          console.log('🔒 跳過可見性重新載入（剛使用傳遞的資料）');
          return;
        }
        if (recentlyUpdated) {
          console.log('🔒 跳過可見性重新載入（剛更新過進度）');
          return;
        }
        console.log('頁面變為可見，重新載入新手進度');
        loadOnboardingData();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [skipFocusReload]);
  
  // 自動檢測任務完成狀態 - 按順序處理，避免狀態覆蓋
  const autoDetectTaskCompletion = async () => {
    if (!onboardingProgress || onboardingProgress.is_completed || autoDetectRunning) {
      return;
    }
    
    // 檢查哪些任務已完成，避免重複檢測
    const completedTasks = {
      photo_upload: onboardingProgress.tasks.photo_upload?.completed || false,
      mark_consumed: onboardingProgress.tasks.mark_consumed?.completed || false,
      recipe_view: onboardingProgress.tasks.recipe_view?.completed || false
    };
    
    console.log('🔍 自動檢測開始，目前任務狀態:', completedTasks);
    
    // 如果所有任務都完成了，跳過檢測
    if (completedTasks.photo_upload && completedTasks.mark_consumed && completedTasks.recipe_view) {
      console.log('✅ 所有任務已完成，跳過自動檢測');
      return;
    }
    
    setAutoDetectRunning(true);
    
    try {
      // 任務1：拍照入庫 - 優先檢測（只有在任務未完成時才檢測）
      if (!onboardingProgress.tasks.photo_upload?.completed) {
        const hasImageItem = foodItems.some(item => item.image_url && item.image_url.trim() !== '');
        if (hasImageItem) {
          console.log('🔍 自動檢測到已有含圖片的食材，完成 photo_upload 任務');
          const result = await completeOnboardingTask('photo_upload');
          console.log('📊 photo_upload 完整回應:', result);
          
          if (result?.progress) {
            console.log('🔄 直接更新 photo_upload 進度狀態，新狀態:', result.progress);
            console.log('📋 photo_upload 任務狀態詳細:', {
              photo_upload: {
                completed: result.progress.tasks?.photo_upload?.completed,
                completed_at: result.progress.tasks?.photo_upload?.completed_at
              },
              mark_consumed: {
                completed: result.progress.tasks?.mark_consumed?.completed,
                completed_at: result.progress.tasks?.mark_consumed?.completed_at
              },
              recipe_view: {
                completed: result.progress.tasks?.recipe_view?.completed,
                completed_at: result.progress.tasks?.recipe_view?.completed_at
              }
            });
            setOnboardingProgress(result.progress);
            saveProgressToStorage(result.progress);
            
            // 標記為剛更新，防止被 loadOnboardingData 覆蓋
            console.log('🔒 設定 recentlyUpdated = true，10秒後重置');
            setRecentlyUpdated(true);
            setTimeout(() => {
              console.log('🔓 重置 recentlyUpdated = false');
              setRecentlyUpdated(false);
            }, 10000);
            
            // 檢查是否顯示慶典
            if (result.show_celebration) {
              setCelebrationVisible(true);
            }
          }
          console.log('✅ photo_upload 任務處理完成，等待下次檢測其他任務');
          return; // 完成一個任務後立即返回，避免同時處理多個任務
        }
      }
      
      // 任務2：查看AI食譜 - 改為手動點擊「食譜推薦」按鈕觸發，不在自動檢測中處理
      
      // 任務3是手動的 mark_consumed，不在自動檢測中處理
      console.log('🔍 自動檢測：沒有發現需要完成的任務');
    } catch (error) {
      console.log('自動檢測任務失敗:', error);
    } finally {
      // 1.5秒後重置檢測標記，給狀態更新更多時間
      setTimeout(() => {
        setAutoDetectRunning(false);
      }, 1500);
    }
  };

  // 載入新手引導資料
  const loadOnboardingData = async () => {
    try {
      console.log('🔍 loadOnboardingData 被呼叫，recentlyUpdated =', recentlyUpdated);
      // 如果剛剛更新過進度，跳過此次載入避免覆蓋
      if (recentlyUpdated) {
        console.log('🔒 跳過 loadOnboardingData，剛更新過進度');
        return;
      }
      
      // 檢查 localStorage 中的最近更新時間，如果在60秒內則跳過 API 呼叫
      const storedProgress = getProgressFromStorage();
      if (storedProgress && storedProgress.lastUpdated) {
        const timeDiff = Date.now() - storedProgress.lastUpdated;
        console.log('⏰ localStorage 時間差異:', timeDiff, 'ms，60秒內？', timeDiff < 60000);
        if (timeDiff < 60000) {
          console.log('🔒 跳過 API 載入，使用最近的 localStorage 資料');
          setOnboardingProgress(storedProgress);
          setShowOnboarding(true);
          return;
        } else {
          console.log('🔄 localStorage 資料過舊，呼叫 API 更新');
        }
      } else {
        console.log('📱 沒有 localStorage 資料，呼叫 API');
      }
      
      // 檢查是否已手動關閉（24小時內）
      try {
        const dismissedData = localStorage.getItem(ONBOARDING_DISMISSED_KEY);
        if (dismissedData) {
          const { dismissed, dismissedAt } = JSON.parse(dismissedData);
          if (dismissed && (Date.now() - dismissedAt) < 24 * 60 * 60 * 1000) {
            console.log('📱 新手卡片在24小時內已被關閉，跳過顯示');
            return;
          }
        }
      } catch (e) {
        console.log('檢查關閉狀態失敗:', e);
      }
      
      const shouldShow = await shouldShowOnboardingTutorial();
      if (shouldShow.should_show) {
        setShowOnboarding(true);
        
        // 嘗試載入進度，但即使失敗也要顯示卡片
        try {
          const progress = await getOnboardingProgress();
          console.log('🔍 loadOnboardingData - getOnboardingProgress 完整回應:', progress);
          console.log('🔍 loadOnboardingData - progress.data:', progress.data);
          console.log('🔍 loadOnboardingData - progress.data?.data:', progress.data?.data);
          // 先嘗試 progress.data，如果不行再嘗試 progress.data.data
          const progressData = progress.data?.data || progress.data;
          console.log('🔍 loadOnboardingData - 最終使用的資料:', progressData);
          setOnboardingProgress(progressData);
          
          // 保存到 localStorage 作為備份
          if (progressData) {
            saveProgressToStorage(progressData);
          }
        } catch (progressError) {
          console.log('載入新手進度失敗，嘗試使用 localStorage 備份:', progressError);
          
          // 嘗試從 localStorage 讀取備份
          const storedProgress = getProgressFromStorage();
          if (storedProgress) {
            console.log('📱 使用 localStorage 備份資料');
            setOnboardingProgress(storedProgress);
          } else {
            console.log('💾 沒有有效的備份，使用預設值');
            // 設定預設進度，確保卡片能顯示
            const defaultProgress = {
              is_completed: false,
              completed_at: null,
              tasks: {
                photo_upload: { completed: false, completed_at: null },
                mark_consumed: { completed: false, completed_at: null },
                recipe_view: { completed: false, completed_at: null }
              },
              achievement_sent: false
            };
            setOnboardingProgress(defaultProgress);
            saveProgressToStorage(defaultProgress);
          }
        }
      }
    } catch (error) {
      console.log('檢查新手教學狀態失敗:', error);
      // 封測期間：如果 API 失敗，仍然顯示新手教學
      setShowOnboarding(true);
      
      // 嘗試使用 localStorage 備份
      const storedProgress = getProgressFromStorage();
      if (storedProgress) {
        console.log('📱 API失敗，使用 localStorage 備份資料');
        setOnboardingProgress(storedProgress);
      } else {
        const defaultProgress = {
          is_completed: false,
          completed_at: null,
          tasks: {
            photo_upload: { completed: false, completed_at: null },
            mark_consumed: { completed: false, completed_at: null },
            recipe_view: { completed: false, completed_at: null }
          },
          achievement_sent: false
        };
        setOnboardingProgress(defaultProgress);
        saveProgressToStorage(defaultProgress);
      }
    }
  };

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

  // 處理移出冰箱（顯示選擇 Modal）
  const handleDelete = (item) => {
    setSelectedItemForDisposal(item);
    setDisposalModalVisible(true);
  };

  // 處理食材處置（用完/丟棄）
  const handleDisposal = async (disposalReason) => {
    if (!selectedItemForDisposal) return;

    try {
      setDisposalLoading(true);
      await archiveFoodItem(selectedItemForDisposal.id, disposalReason);
      const reasonText = disposalReason === 'used' ? '用完' : '丟棄';
      message.success(`「${selectedItemForDisposal.name}」已標記為${reasonText}`);
      
      // 觸發新手任務2：標記用完（僅當選擇"用完"時）
      if (disposalReason === 'used') {
        try {
          console.log('🔍 呼叫 completeOnboardingTask(mark_consumed)');
          const result = await completeOnboardingTask('mark_consumed');
          console.log('🔍 mark_consumed completeOnboardingTask 完整回應:', result);
          
          if (result?.progress) {
            console.log('🔄 直接更新 mark_consumed 進度狀態，新狀態:', result.progress);
            console.log('📋 mark_consumed 任務狀態詳細:', {
              photo_upload: {
                completed: result.progress.tasks?.photo_upload?.completed,
                completed_at: result.progress.tasks?.photo_upload?.completed_at
              },
              mark_consumed: {
                completed: result.progress.tasks?.mark_consumed?.completed,
                completed_at: result.progress.tasks?.mark_consumed?.completed_at
              },
              recipe_view: {
                completed: result.progress.tasks?.recipe_view?.completed,
                completed_at: result.progress.tasks?.recipe_view?.completed_at
              }
            });
            setOnboardingProgress(result.progress);
            saveProgressToStorage(result.progress);
            
            // 標記為剛更新，防止被 loadOnboardingData 覆蓋
            console.log('🔒 設定 recentlyUpdated = true，10秒後重置');
            setRecentlyUpdated(true);
            setTimeout(() => {
              console.log('🔓 重置 recentlyUpdated = false');
              setRecentlyUpdated(false);
            }, 10000);
            
            // 檢查是否顯示慶典
            if (result.show_celebration) {
              setCelebrationVisible(true);
            }
          } else {
            console.log('❌ mark_consumed API 回應中沒有 progress 資料，強制重新載入');
            setTimeout(() => {
              if (!recentlyUpdated) {
                loadOnboardingData();
              } else {
                console.log('🔒 跳過強制重新載入（剛更新過進度）');
              }
            }, 500);
          }
        } catch (error) {
          console.log('更新新手進度失敗:', error);
        }
      }
      
      setDisposalModalVisible(false);
      setSelectedItemForDisposal(null);
      await loadData();
    } catch (error) {
      console.error('處理失敗:', error);
      message.error('操作失敗，請稍後再試');
    } finally {
      setDisposalLoading(false);
    }
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


  // 分區排序順序（新版 3 分區）
  const compartmentOrder = ['冷藏上層', '冷藏下層', '冷凍'];
  
  // 檢查是否有自設分區（自訂模式）
  const isCustomMode = () => {
    if (fridges.length === 0 || !fridges[0].compartments) return false;
    
    // 檢查是否有非預設分區
    const customCompartments = fridges[0].compartments.filter(comp => 
      !['冷藏上層', '冷藏下層', '冷凍'].includes(comp.name)
    );
    
    return customCompartments.length > 0;
  };

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

    // 按照 sort_order 排序分區
    const sortedGroups = {};
    
    // 如果有分區資料，按照 sort_order 排序
    if (fridges.length > 0 && fridges[0].compartments) {
      const sortedCompartments = fridges[0].compartments
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      
      sortedCompartments.forEach((compartment) => {
        if (groups[compartment.name]) {
          sortedGroups[compartment.name] = groups[compartment.name];
        }
      });
      
      // 加入未在分區列表中的分組（如未分類）
      Object.keys(groups).forEach((compartmentName) => {
        const existsInCompartments = fridges[0].compartments.some(
          comp => comp.name === compartmentName
        );
        if (!existsInCompartments) {
          sortedGroups[compartmentName] = groups[compartmentName];
        }
      });
    } else {
      // 沒有分區資料時使用預設排序
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
    }

    return sortedGroups;
  };

  // 處理新手引導卡片關閉
  const handleOnboardingClose = () => {
    setShowOnboarding(false);
    // 保存關閉狀態到 localStorage（24小時內不再顯示）
    try {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, JSON.stringify({
        dismissed: true,
        dismissedAt: Date.now()
      }));
      console.log('💾 新手卡片關閉狀態已保存');
    } catch (error) {
      console.log('保存關閉狀態失敗:', error);
    }
  };

  // 處理成就慶典確認
  const handleCelebrationConfirm = async () => {
    try {
      await markCelebrationSent();
      setShowOnboarding(false);
    } catch (error) {
      console.log('標記慶典失敗:', error);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Content style={{ padding: '16px' }}>
        {/* 新手三部曲卡片 */}
        {showOnboarding && (
          <OnboardingCard
            progress={onboardingProgress}
            onClose={handleOnboardingClose}
            isVisible={showOnboarding}
          />
        )}

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
            {/* 冰箱模式標籤與食譜推薦按鈕 */}
            {fridges.length > 0 && (
              <div style={{ paddingBottom: 12, borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* 左邊：冰箱模式標籤 */}
                <Tag 
                  color={
                    isCustomMode() ? 'gold' : 
                    (fridges[0].compartment_mode === 'detailed' ? 'purple' : 'default')
                  }
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate('/settings')}
                >
                  {
                    isCustomMode() ? '🛠️ 自訂模式' :
                    (fridges[0].compartment_mode === 'detailed' ? '🗂️ 細分模式' : '📦 簡易模式')
                  }
                </Tag>
                
                {/* 右邊：食譜推薦按鈕 */}
                <Button
                  type="primary"
                  size="small"
                  icon={<BulbOutlined />}
                  onClick={async () => {
                    // 觸發新手任務2：查看AI食譜
                    if (onboardingProgress && !onboardingProgress.tasks.recipe_view?.completed) {
                      try {
                        console.log('🔍 點擊食譜推薦按鈕，完成 recipe_view 任務');
                        const result = await completeOnboardingTask('recipe_view');
                        console.log('📊 recipe_view 按鈕完整回應:', result);
                        console.log('🔍 檢查 result?.progress:', !!result?.progress, result?.progress);
                        console.log('🔍 檢查 result.progress:', !!result.progress, result.progress);
                        
                        if (result?.progress) {
                          console.log('🔄 直接更新 recipe_view 進度狀態，新狀態:', result.progress);
                          console.log('📋 recipe_view 按鈕任務狀態詳細:', {
                            photo_upload: {
                              completed: result.progress.tasks?.photo_upload?.completed,
                              completed_at: result.progress.tasks?.photo_upload?.completed_at
                            },
                            mark_consumed: {
                              completed: result.progress.tasks?.mark_consumed?.completed,
                              completed_at: result.progress.tasks?.mark_consumed?.completed_at
                            },
                            recipe_view: {
                              completed: result.progress.tasks?.recipe_view?.completed,
                              completed_at: result.progress.tasks?.recipe_view?.completed_at
                            }
                          });
                          
                          console.log('⚡ 步驟 1: 即將呼叫 setOnboardingProgress');
                          setOnboardingProgress(result.progress);
                          console.log('⚡ 步驟 2: setOnboardingProgress 完成');
                          
                          console.log('⚡ 步驟 3: 即將呼叫 saveProgressToStorage');
                          saveProgressToStorage(result.progress);
                          console.log('⚡ 步驟 4: saveProgressToStorage 完成');
                          
                          // 標記為剛更新，防止被 loadOnboardingData 覆蓋
                          console.log('⚡ 步驟 5: 即將設定 recentlyUpdated = true');
                          console.log('🔒 設定 recentlyUpdated = true，10秒後重置');
                          setRecentlyUpdated(true);
                          console.log('⚡ 步驟 6: setRecentlyUpdated(true) 完成');
                          
                          setTimeout(() => {
                            console.log('🔓 重置 recentlyUpdated = false');
                            setRecentlyUpdated(false);
                          }, 10000);
                          console.log('⚡ 步驟 7: setTimeout 設定完成');
                          
                          // 檢查是否顯示慶典
                          console.log('⚡ 步驟 8: 檢查慶典顯示，show_celebration:', result.show_celebration);
                          if (result.show_celebration) {
                            console.log('⚡ 步驟 9: 顯示慶典');
                            setCelebrationVisible(true);
                          }
                          
                          console.log('⚡ 所有步驟完成');
                        } else {
                          console.log('❌ result?.progress 為 false，無法更新進度');
                        }
                      } catch (error) {
                        console.log('完成食譜推薦任務失敗:', error);
                      }
                    }
                    
                    // 檢查是否有收藏食譜
                    const totalRecipes = recipeCategoryCounts.favorites + recipeCategoryCounts['常煮'] + recipeCategoryCounts.pro;
                    if (totalRecipes === 0) {
                      // 沒有收藏食譜時，顯示引導訊息
                      Modal.info({
                        title: '🍳 食譜推薦功能',
                        content: (
                          <div>
                            <p>歡迎使用智能食譜推薦！</p>
                            <p>📝 <strong>如何開始：</strong></p>
                            <p>1. 點選「食譜推薦」查看 AI 建議</p>
                            <p>2. 將喜歡的食譜加入收藏</p>
                            <p>3. 收藏的食譜會顯示在這裡</p>
                          </div>
                        ),
                        okText: '前往食譜推薦',
                        onOk: () => navigate('/recipes/recommendations'),
                      });
                    } else {
                      navigate('/recipes/recommendations');
                    }
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #52c41a 0%, #faad14 100%)',
                    border: 'none',
                    fontWeight: 'bold',
                  }}
                >
                  食譜推薦
                  {(recipeCategoryCounts.favorites + recipeCategoryCounts['常煮'] + recipeCategoryCounts.pro) > 0 && (
                    <span style={{ 
                      marginLeft: 4, 
                      background: '#fff', 
                      color: '#52c41a', 
                      borderRadius: '10px', 
                      padding: '0 6px', 
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}>
                      {recipeCategoryCounts.favorites + recipeCategoryCounts['常煮'] + recipeCategoryCounts.pro}
                    </span>
                  )}
                </Button>
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

                    {/* 食材列表 - Grid 布局 */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                      }}
                    >
                      {items.map((item) => (
                        <FoodItemCard
                          key={item.id}
                          item={item}
                          onClick={() => navigate(`/edit/${item.id}`)}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
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

        {/* 處理方式選擇 Modal */}
        <Modal
          title={`「${selectedItemForDisposal?.name}」怎麼處理了？`}
          open={disposalModalVisible}
          onCancel={() => {
            setDisposalModalVisible(false);
            setSelectedItemForDisposal(null);
          }}
          footer={null}
          centered
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Button
              type="primary"
              size="large"
              block
              icon={<CheckCircleOutlined />}
              onClick={() => handleDisposal('used')}
              loading={disposalLoading}
              style={{ height: 60, fontSize: 16 }}
            >
              ✅ 已用完（煮掉/吃掉）
            </Button>
            <Button
              danger
              size="large"
              block
              icon={<DeleteOutlined />}
              onClick={() => handleDisposal('wasted')}
              loading={disposalLoading}
              style={{ height: 60, fontSize: 16 }}
            >
              🗑️ 已丟棄（過期/壞掉）
            </Button>
            <div style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
              這將幫助計算你節省了多少食材浪費
            </div>
          </Space>
        </Modal>

        {/* 成就慶典彈窗 */}
        <AchievementCelebration
          visible={celebrationVisible}
          onClose={() => setCelebrationVisible(false)}
          onConfirm={handleCelebrationConfirm}
        />
      </Content>
    </Layout>
  );
}

export default Home;
