import React from 'react';
import { Redirect, Route, RouteProps } from 'react-router-dom';
import { IonPage, IonSpinner } from '@ionic/react';
import { useAuth } from '../contexts/AuthContext';
import {
  hasSeenWelcome,
  canAccessStep,
  getCurrentAllowedStepPath,
  OnboardingStep,
} from '../utils/welcomeStorage';
import { StartupDebug } from '../StartupDebug';
import { logBootStep } from '../bootLogger';

interface WelcomeRouteProps extends RouteProps {
  step: OnboardingStep;
}

/**
 * Route guard for onboarding screens (/welcome, /welcome-2, /cultural-intro).
 * Requires auth, blocks re-entry once onboarding is fully done, and enforces
 * step order — jumping ahead redirects back to wherever the user actually is.
 */
export default function WelcomeRoute({ step, children, ...rest }: WelcomeRouteProps) {
  try {
    logBootStep('[BOOT 09] WelcomeRoute entered');
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

    if (hasSeenWelcome(user.uid)) {
      return <Redirect to="/home" />;
    }

    if (!canAccessStep(user.uid, step)) {
      return <Redirect to={getCurrentAllowedStepPath(user.uid)} />;
    }

    return <Route {...rest}>{children}</Route>;
  } catch (error) {
    return <StartupDebug error={error as Error} component="WelcomeRoute" />;
  }
}