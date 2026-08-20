import React, { useEffect } from 'react'; // <--- 1. Import useEffect
import { Redirect, Route, RouteProps } from 'react-router-dom';
import { IonPage, IonSpinner } from '@ionic/react';
import { useAuth } from '../contexts/AuthContext';
import { StartupDebug } from '../StartupDebug';
import { logBootStep } from '../bootLogger';

/**
 * Route guard that redirects unauthenticated users to /login.
 */
export default function ProtectedRoute({ children, ...rest }: RouteProps) {
  try {
    const { user, loading } = useAuth();

    // 2. Move the log inside a useEffect
    useEffect(() => {
      logBootStep('[BOOT 09] ProtectedRoute entered');
    }, []); // <--- Empty array means it ONLY runs ONCE when the component first appears

    if (loading) {
      return (
        <Route {...rest}>
          <IonPage>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <IonSpinner />
            </div>
          </IonPage>
        </Route>
      );
    }

    if (!user) {
      return <Redirect to="/login" />;
    }

    return <Route {...rest}>{children}</Route>;
  } catch (error) {
    return <StartupDebug error={error as Error} component="ProtectedRoute" />;
  }
}