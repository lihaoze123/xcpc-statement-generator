/**
 * 处理导入数据时的同步状态更新
 */
export function handleDataImportSync(
  data: any,
  setSyncStatus: (status: 'synced' | 'syncing' | 'pending' | 'disabled') => void,
  setLastSyncTime: (time: number) => void,
  lastSyncDataRef: React.MutableRefObject<string>
) {
  // Update sync status to reflect the imported data
  setSyncStatus('synced');
  setLastSyncTime(Date.now());
  lastSyncDataRef.current = JSON.stringify({
    meta: data.meta,
    problems: data.problems,
  });
}
