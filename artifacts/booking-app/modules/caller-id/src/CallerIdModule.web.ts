/**
 * Web / Expo Go stub for CallerIdModule.
 * All methods are no-ops; the permission and detection hooks check Platform.OS
 * before calling any of these, so this stub is only a safety net.
 */
const CallerIdModuleWeb = {
  startListening: () => {},
  stopListening: () => {},
  isListening: () => false,
  // EventEmitter stub — listeners are never called on web
  addListener: (_eventName: string, _listener: (...args: any[]) => void) => ({
    remove: () => {},
  }),
  removeAllListeners: (_eventName: string) => {},
};

export default CallerIdModuleWeb;
