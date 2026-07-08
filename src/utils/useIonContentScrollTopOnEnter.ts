import { useRef } from 'react';
import { useIonViewWillEnter } from '@ionic/react';

/**
 * Ionic keeps stacked views mounted, so IonContent retains scroll when navigating away.
 * Use on each main route page so returning to the tab starts at the top again.
 */
export function useIonContentScrollTopOnEnter() {
  const contentRef = useRef<HTMLIonContentElement>(null);
  useIonViewWillEnter(() => {
    void contentRef.current?.scrollToTop(0);
  });
  return contentRef;
}
