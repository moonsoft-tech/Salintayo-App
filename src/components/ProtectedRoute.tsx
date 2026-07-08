import React from 'react';
import { Redirect, Route, RouteProps } from 'react-router-dom';
import { IonPage, IonSpinner } from '@ionic/react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Route guard that redirects unauthenticated users to /login.
 */
export default function ProtectedRoute({ children, ...rest }: RouteProps) {
  const { user, loading } = useAuth();

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
}
