// =============================================================================
// EUROTRIPS — Rooming Trigger Queue (BullMQ)
// Черга для періодичного сканування BR-11 (див. rooming-trigger.service.ts)
// =============================================================================

import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { createRedisConnection } from '../communications/email.queue';

export type RoomingScanQueue = Queue<Record<string, never>, void, 'scan'>;

const QUEUE_NAME = 'ops-rooming-trigger';
const REPEATABLE_JOB_ID = 'ops-rooming-scan-hourly';

export function createRoomingScanQueue(connection?: IORedis): RoomingScanQueue {
  const conn = connection ?? createRedisConnection();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Queue(QUEUE_NAME, { connection: conn as any }) as RoomingScanQueue;
}

/**
 * Реєструє повторюваний job сканування (раз на годину).
 * jobId фіксований — BullMQ не створить дублікат при повторному виклику
 * (напр. після кожного рестарту сервера).
 */
export async function scheduleRoomingScan(queue: RoomingScanQueue): Promise<void> {
  await queue.add(
    'scan',
    {},
    {
      repeat: { every: 60 * 60 * 1000 }, // щогодини
      jobId: REPEATABLE_JOB_ID,
    }
  );
}
