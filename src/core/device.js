// Device detection used to switch to touch controls and the mobile performance profile.
const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const touch = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0);
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const forced = typeof location !== 'undefined' && /[?&]mobile/.test(location.search);
export const IS_MOBILE = forced || (touch && (coarse || /Android|iPhone|iPad|iPod|Mobile/i.test(ua)));
