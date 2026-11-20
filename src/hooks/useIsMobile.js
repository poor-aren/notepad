import { useSyncExternalStore } from 'react';

const mq = window.matchMedia('(max-width: 800px)');
const subscribe = (cb) => { mq.addEventListener('change', cb); return () => mq.removeEventListener('change', cb); };

export const useIsMobile = () => useSyncExternalStore(subscribe, () => mq.matches);
