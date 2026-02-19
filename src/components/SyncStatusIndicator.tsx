import { type FC } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCloud, faCloudArrowDown, faCloudArrowUp } from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "react-i18next";

interface SyncStatusIndicatorProps {
  /**
   * 同步状态
   * 'synced': 已同步
   * 'syncing': 同步中
   * 'pending': 待同步（有本地修改）
   * 'disabled': 未配置
   */
  status: 'synced' | 'syncing' | 'pending' | 'disabled';
  /**
   * 同步方向（上传/下载）
   */
  syncDirection?: 'upload' | 'download';
  /**
   * 最后同步时间戳
   */
  lastSyncTime?: number;
  /**
   * 点击时的回调
   */
  onClick?: () => void;
}

const SyncStatusIndicator: FC<SyncStatusIndicatorProps> = ({
  status,
  syncDirection = 'upload',
  lastSyncTime,
  onClick,
}) => {
  const { t } = useTranslation();

  const getStatusInfo = () => {
    switch (status) {
      case 'synced':
        return {
          icon: faCloud,
          color: 'text-green-600',
          tooltip: lastSyncTime
            ? t('online:synced') + ': ' + new Date(lastSyncTime).toLocaleString()
            : t('online:synced'),
        };
      case 'syncing':
        return {
          icon: syncDirection === 'upload' ? faCloudArrowUp : faCloudArrowDown,
          color: 'text-blue-600',
          tooltip: t('online:syncing'),
        };
      case 'pending':
        return {
          icon: faCloud,
          color: 'text-orange-500',
          tooltip: '点击同步',
        };
      case 'disabled':
        return {
          icon: faCloud,
          color: 'text-gray-400',
          tooltip: t('online:not_configured'),
        };
    }
  };

  const info = getStatusInfo();

  return (
    <div className="tooltip tooltip-bottom" data-tip={info.tooltip}>
      <button
        onClick={onClick}
        disabled={status === 'disabled' || status === 'syncing'}
        className={`
          flex items-center justify-center
          w-8 h-8 rounded
          text-sm
          ${status === 'disabled' ? 'bg-gray-100 cursor-not-allowed' : 'bg-white border border-gray-200 hover:bg-gray-50 cursor-pointer'}
        `}
        style={{ color: status === 'disabled' ? '#9ca3af' : undefined }}
      >
        <FontAwesomeIcon icon={info.icon} className={info.color} />
      </button>
    </div>
  );
};

export default SyncStatusIndicator;
