import React from 'react';
import { Redirect } from 'react-router-dom';
import { IonPage, IonSpinner } from '@ionic/react';
import { useAuth } from '../contexts/AuthContext';
import { hasSeenWelcome } from '../utils/welcomeStorage';

/**
 * Handles root "/" route: sends logged-in users to home/welcome, others to login.
 */
export default function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <IonPage>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <IonSpinner />
        </div>
      </IonPage>
    );
  }

  if (user) {
    return <Redirect to={hasSeenWelcome(user.uid) ? '/home' : '/welcome'} />;
  }

  return <Redirect to="/login" />;
}
