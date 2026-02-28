// wsCloseCodes: Custom WebSocket close code constants for the Disco Incognito protocol. NOT concerned with connection management. | I/O: none → exports constants
export const WS_CLOSE = {
  /** Server replaced this socket with a newer connection from the same user. */
  REPLACED: 4000,
  /** Pong not received within watchdog timeout — dead connection detected. */
  PONG_TIMEOUT: 4001,
  /** Room does not exist or has been deleted. */
  ROOM_NOT_FOUND: 4004,
} as const;
