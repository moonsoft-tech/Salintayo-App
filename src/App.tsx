import React, { useEffect, useState } from 'react';
import { Redirect, Route, useLocation } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import ProtectedRoute from './components/ProtectedRoute';
import RootRedirect from './components/RootRedirect';
import Home from './pages/Home';
import LoginPage from './pages/Login';
import WelcomeSlide1 from './pages/WelcomeSlide1';
import WelcomeSlide2 from './pages/WelcomeSlide2';
import Learn from './pages/Learn';
import DialectDetail from './pages/DialectDetail';
import Quiz from './pages/Quiz';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import CulturalIntroSlide from './pages/CulturalIntroSlide';
import QuickChatBubble from './pages/QuickChatBubble';
import { useAuth } from './contexts/AuthContext';

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

/**
 * Routes where the bubble stays hidden until the learner navigates to at least
 * one other screen in this session (so the first Home / welcome landing is not covered).
 */
const QCB_SUPPRESS_UNTIL_NAV_AWAY = ['/home', '/welcome', '/welcome-2', '/cultural-intro'] as const;
const QCB_SUPPRESS_LANDING_SET = new Set<string>(QCB_SUPPRESS_UNTIL_NAV_AWAY);

const QCB_PATHS_THAT_DONT_COUNT_AS_LEFT_LANDING = new Set<string>([
  '/',
  '/login',
  ...QCB_SUPPRESS_UNTIL_NAV_AWAY,
]);

const QCB_LEFT_LANDING_SESSION_KEY = 'salintayo_qcb_left_landing';

/** Quick Chat only for signed-in users; not on login/root; one instance app-wide. */
const QuickChatBubbleGate: React.FC = () => {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const [leftFirstLanding, setLeftFirstLanding] = useState(() => {
    try {
      return sessionStorage.getItem(QCB_LEFT_LANDING_SESSION_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!QCB_PATHS_THAT_DONT_COUNT_AS_LEFT_LANDING.has(pathname)) {
      try {
        sessionStorage.setItem(QCB_LEFT_LANDING_SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
      setLeftFirstLanding(true);
    }
  }, [pathname]);

  if (pathname === '/' || pathname === '/login') return null;
  if (loading || !user) return null;
  if (QCB_SUPPRESS_LANDING_SET.has(pathname) && !leftFirstLanding) {
    return null;
  }
  return <QuickChatBubble />;
};

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <IonRouterOutlet>
        <ProtectedRoute exact path="/home">
          <Home />
        </ProtectedRoute>
        <ProtectedRoute exact path="/learn">
          <Learn />
        </ProtectedRoute>
        <ProtectedRoute exact path="/learn/:dialectId">
          <DialectDetail />
        </ProtectedRoute>
        <ProtectedRoute exact path="/quiz">
          <Quiz />
        </ProtectedRoute>
        <ProtectedRoute exact path="/chat">
          <Chat />
        </ProtectedRoute>
        <ProtectedRoute exact path="/profile">
          <Profile />
        </ProtectedRoute>
        <ProtectedRoute exact path="/cultural-intro">
          <CulturalIntroSlide />
        </ProtectedRoute>
        <Route exact path="/">
          <RootRedirect />
        </Route>
        <ProtectedRoute exact path="/welcome">
          <WelcomeSlide1 />
        </ProtectedRoute>
        <ProtectedRoute exact path="/welcome-2">
          <WelcomeSlide2 />
        </ProtectedRoute>
        <Route exact path="/login">
          <LoginPage />
        </Route>
      </IonRouterOutlet>
      <QuickChatBubbleGate />
    </IonReactRouter>
  </IonApp>
);

export default App;
