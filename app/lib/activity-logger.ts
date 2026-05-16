import { activityLogData } from './data';
import type { ActivityLog } from '../../types';

type LogAction = ActivityLog['action'];
type LogEntity = ActivityLog['entity'];

export function logActivity(
  userId: string,
  username: string,
  action: LogAction,
  entity: LogEntity,
  description: string,
  entityId?: string,
  details?: string,
) {
  activityLogData.create({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    userId,
    username,
    action,
    entity,
    entityId,
    description,
    details,
  });
}
