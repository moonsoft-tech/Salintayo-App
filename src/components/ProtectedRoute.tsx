import React from 'react';
import { Redirect, Route, RouteProps } from 'react-router-dom';
import { IonPage, IonSpinner } from '@ionic/react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Route guard that redirects unauthenticated users to /login.
 * Use for pages that require server-verified auth.
 */
export default function ProtectedRoute({ children, ...rest }: RouteProps) {
  const { user, loading } = useAuth();

  return (
    <Route
      {...rest}
      render={({ location }): React.ReactNode => {
        if (loading) {
          return (
            <IonPage>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <IonSpinner />
              </div>
            </IonPage>
          );
        }
        if (!user) {
          return <Redirect to={{ pathname: '/login', state: { from: location } }} />;
        }
        return <>{children}</>;
      }}
    />
  );
}
