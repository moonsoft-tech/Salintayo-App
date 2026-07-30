import React from 'react';
import { Redirect, Route, useLocation } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import ProtectedRoute from './components/ProtectedRoute';
import WelcomeRoute from './components/WelcomeRoute';
import RootRedirect from './components/RootRedirect';
import Home from './pages/Home';
import LoginPage from './pages/Login';
import WelcomeSlide1 from './pages/WelcomeSlide1';
import WelcomeSlide2 from './pages/WelcomeSlide2';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import CulturalIntroSlide from './pages/CulturalIntroSlide';
import QuickChatBubble from './pages/QuickChatBubble';
import { useAuth } from './contexts/AuthContext';
import { logBootStep } from './bootLogger';
import { StartupDebug } from './StartupDebug';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

/** Paths where the bubble should never show — onboarding screens plus root/login. */
const QCB_HIDDEN_PATHS = new Set<string>(['/', '/login', '/welcome', '/welcome-2', '/cultural-intro']);

/** Quick Chat only for signed-in users who've finished onboarding; not on login/root/welcome. */
const QuickChatBubbleGate: React.FC = () => {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading || !user) return null;
  if (QCB_HIDDEN_PATHS.has(pathname)) return null;
  return <QuickChatBubble />;
};

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <IonRouterOutlet>
        <ProtectedRoute exact path="/home">
          <Home />
        </ProtectedRoute>

        <ProtectedRoute exact path="/chat">
          <Chat />
        </ProtectedRoute>
        <ProtectedRoute exact path="/profile">
          <Profile />
        </ProtectedRoute>
        <WelcomeRoute exact path="/cultural-intro" step="cultural-intro">
          <CulturalIntroSlide />
        </WelcomeRoute>
        <Route exact path="/">
          <RootRedirect />
        </Route>
        <WelcomeRoute exact path="/welcome" step="welcome">
          <WelcomeSlide1 />
        </WelcomeRoute>
        <WelcomeRoute exact path="/welcome-2" step="welcome2">
          <WelcomeSlide2 />
        </WelcomeRoute>
        <Route exact path="/login">
          <LoginPage />
        </Route>
      </IonRouterOutlet>
      <QuickChatBubbleGate />
    </IonReactRouter>
  </IonApp>
);

export default App;
