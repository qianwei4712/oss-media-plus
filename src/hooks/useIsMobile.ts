import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 1100;

export function useIsMobile() {
  const getMatches = () => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= MOBILE_BREAKPOINT;
  };

  const [isMobile, setIsMobile] = useState(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onResize = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };

    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return isMobile;
}
