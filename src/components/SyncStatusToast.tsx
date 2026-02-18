import { type FC } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCloud, faCloudArrowDown, faX } from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "react-i18next";

interface SyncStatusToastProps {
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
  /**
   * 关闭浮动框的回调
   */
  onClose?: () => void;
}

const SyncStatusToast: FC<SyncStatusToastProps> = ({
  status,
  lastSyncTime,
  onClick,
  onClose,
}) => {
  const { t } = useTranslation();

  const getStatusInfo = () => {
    switch (status) {
      case 'synced':
        return {
          icon: faCloud,
          color: 'text-green-500',
          bgColor: 'bg-green-50 border-green-200',
          title: t('online:synced'),
          message: lastSyncTime
            ? new Date(lastSyncTime).toLocaleString()
            : t('online:synced'),
          animated: false,
          autoHide: true,
        };
      case 'syncing':
        return {
          icon: faCloudArrowDown,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50 border-blue-200',
          title: t('online:syncing'),
          message: t('online:syncing_description'),
          animated: true,
          autoHide: false,
        };
      case 'pending':
        return {
          icon: faCloud,
          color: 'text-orange-500',
          bgColor: 'bg-orange-50 border-orange-200',
          title: t('online:pending_sync'),
          message: t('online:click_to_sync'),
          animated: false,
          autoHide: false,
        };
      case 'disabled':
        return {
          icon: faCloud,
          color: 'text-gray-400',
          bgColor: 'bg-gray-50 border-gray-200',
          title: t('online:not_configured'),
          message: t('online:configure_sync'),
          animated: false,
          autoHide: true,
        };
    }
  };

  const info = getStatusInfo();

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div
        className={`
          flex items-start gap-3
          px-4 py-3 rounded-lg
          border
          shadow-lg
          ${info.bgColor}
          max-w-xs
          cursor-pointer
          transition-all duration-200
          hover:shadow-xl
        `}
        onClick={onClick}
      >
        <div className="flex-shrink-0 pt-0.5">
          <FontAwesomeIcon
            icon={info.icon}
            className={`
              text-lg
              ${info.color}
              ${info.animated ? 'animate-spin' : ''}
            `}
          />
        </div>

        <div className="flex-1">
          <h3 className="font-medium text-gray-900 text-sm">
            {info.title}
          </h3>
          <p className="text-gray-600 text-xs mt-1 line-clamp-2">
            {info.message}
          </p>
        </div>

        {onClose && (
          <button
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="关闭"
          >
            <FontAwesomeIcon icon={faX} className="text-xs" />
          </button>
        )}
      </div>
    </div>
  );
};

export default SyncStatusToast;
