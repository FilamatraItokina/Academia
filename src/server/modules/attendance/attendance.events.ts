import { EventEmitter } from 'node:events';

export interface AttendanceBroadcastEvent {
  type: 'attendance:updated';
  date: string;
  classId?: number;
  timestamp: string;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(200);

export function emitAttendanceChanged(date: string, classId?: number): void {
  const payload: AttendanceBroadcastEvent = {
    type: 'attendance:updated',
    date,
    classId,
    timestamp: new Date().toISOString(),
  };
  emitter.emit('attendance:updated', payload);
}

export function onAttendanceChanged(
  listener: (event: AttendanceBroadcastEvent) => void
): () => void {
  emitter.on('attendance:updated', listener);
  return () => {
    emitter.off('attendance:updated', listener);
  };
}
