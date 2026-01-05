/**
 * 版本資訊頁尾元件
 *
 * 顯示應用程式版本和 Git commit hash
 */

import { Typography } from 'antd';

const { Text } = Typography;

function VersionFooter() {
  // 從 Vite define 注入的全域變數
  const gitHash = typeof __GIT_HASH__ !== 'undefined' ? __GIT_HASH__ : 'unknown';
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '16px 0',
        marginTop: '24px',
        borderTop: '1px solid #f0f0f0',
      }}
    >
      <Text style={{ fontSize: '10px', color: '#999' }}>
        AI Fridge Elf v{appVersion} ({gitHash})
      </Text>
    </div>
  );
}

export default VersionFooter;
