import { type FC } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCloud, faCloudArrowDown } from "@fortawesome/free-solid-svg-icons";
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
  lastSyncTime,
  onClick,
}) => {
  const { t } = useTranslation();

  const getStatusInfo = () => {
    switch (status) {
      case 'synced':
        return {
          icon: faCloud,
          color: 'text-green-500',
          bgColor: 'bg-green-50 hover:bg-green-100',
          tooltip: lastSyncTime
            ? t('online:synced') + ': ' + new Date(lastSyncTime).toLocaleString()
            : t('online:synced'),
          animated: false,
        };
      case 'syncing':
        return {
          icon: faCloudArrowDown,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50 hover:bg-blue-100',
          tooltip: t('online:syncing'),
          animated: true,
        };
      case 'pending':
        return {
          icon: faCloud,
          color: 'text-orange-500',
          bgColor: 'bg-orange-50 hover:bg-orange-100',
          tooltip: '点击同步',
          animated: false,
        };
      case 'disabled':
        return {
          icon: faCloud,
          color: 'text-gray-300',
          bgColor: 'bg-gray-50',
          tooltip: t('online:not_configured'),
          animated: false,
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
          w-9 h-9 rounded-lg
          transition-colors duration-200
          ${info.bgColor}
          ${status === 'disabled' || status === 'syncing' ? 'cursor-not-allowed' : 'cursor-pointer'}
          relative
        `}
      >
        <FontAwesomeIcon
          icon={info.icon}
          className={`
            ${info.color}
            ${info.animated ? 'animate-spin' : ''}
          `}
        />

        {/* 待同步警告点 */}
        {status === 'pending' && (
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
        )}
      </button>
    </div>
  );
};

export default SyncStatusIndicator;
