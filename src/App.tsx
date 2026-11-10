import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { useUnread } from "./lib/unread";
import { TabBar } from "./components/TabBar";
import Login from "./pages/auth/Login";
import Welcome from "./pages/auth/Welcome";
import Privacy from "./pages/auth/Privacy";
import Home from "./pages/rider/Home";
import CheckIn from "./pages/rider/CheckIn";
import Goals from "./pages/rider/Goals";
import Competitions from "./pages/rider/Competitions";
import DebriefForm from "./pages/rider/DebriefForm";
import DebriefView from "./pages/rider/DebriefView";
import Routine from "./pages/rider/Routine";
import Messages from "./pages/rider/Messages";
import Progress from "./pages/rider/Progress";
import Sessions from "./pages/rider/Sessions";
import Profile from "./pages/rider/Profile";
import CoachLayout from "./pages/coach/CoachLayout";
import Dashboard from "./pages/coach/Dashboard";
import ClientDetail from "./pages/coach/ClientDetail";
import Invite from "./pages/coach/Invite";
import AutoMessages from "./pages/coach/AutoMessages";
import Settings from "./pages/coach/Settings";
import CoachMessages from "./pages/coach/CoachMessages";

function Loading() {
  return <div className="loading">Chargement…</div>;
}

// Espace cavalière : connexion obligatoire + barre d'onglets
function RiderShell() {
  const { profile } = useAuth();
  const unread = useUnread();
  const loc = useLocation();
  if (profile?.role === "coach") return <Navigate to="/coach" replace />;
  const isChat = loc.pathname === "/messages";
  return (
    <div className={isChat ? undefined : "app"}>
      <Outlet />
      <TabBar unread={isChat ? 0 : unread.group + unread.coach} />
    </div>
  );
}

function Protected({ coach }: { coach?: boolean }) {
  const { loading, session, profile } = useAuth();
  const loc = useLocation();
  if (loading || (session && !profile)) return <Loading />;
  if (!session) return <Navigate to="/connexion" replace state={{ from: loc.pathname }} />;
  if (profile!.status === "archived") return <Archived />;
  if (profile!.role === "rider" && !profile!.consent_at) return <Navigate to="/bienvenue" replace />;
  if (coach && profile!.role !== "coach") return <Navigate to="/" replace />;
  return <Outlet />;
}

function Archived() {
  const { signOut } = useAuth();
  return (
    <div className="app"><div className="page" style={{ justifyContent: "center" }}>
      <h1 className="h1">Ton accès est terminé</h1>
      <p className="muted">Ton compte Évolution a été archivé. Pour toute question, contacte Christina.</p>
      <button className="btn" onClick={signOut}>Me déconnecter</button>
    </div></div>
  );
}

function PublicOnly() {
  const { loading, session, profile } = useAuth();
  if (loading) return <Loading />;
  if (session && profile) return <Navigate to={profile.role === "coach" ? "/coach" : "/"} replace />;
  return <Outlet />;
}

function WelcomeGate() {
  const { loading, session } = useAuth();
  // Le lien d'invitation ouvre la session : on attend qu'elle soit prête
  if (loading || (!session && location.hash.includes("access_token"))) return <Loading />;
  if (!session) {
    const err = new URLSearchParams(location.hash.slice(1)).get("error_description");
    return (
      <div className="app"><div className="page" style={{ justifyContent: "center" }}>
        <h1 className="h1">Ce lien n'est plus valable</h1>
        <p className="muted">{err ? "Il a expiré ou a déjà été utilisé." : "Le lien est incomplet."} Demande à Christina de t'en envoyer un nouveau, ou connecte-toi si tu as déjà ton mot de passe.</p>
        <a className="btn" href="/connexion">Me connecter</a>
      </div></div>
    );
  }
  return <Welcome />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/confidentialite" element={<Privacy />} />
      <Route path="/bienvenue" element={<WelcomeGate />} />
      <Route element={<PublicOnly />}>
        <Route path="/connexion" element={<Login />} />
      </Route>
      <Route element={<Protected />}>
        <Route element={<RiderShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/checkin" element={<CheckIn />} />
          <Route path="/objectifs" element={<Goals />} />
          <Route path="/concours" element={<Competitions />} />
          <Route path="/concours/debrief" element={<DebriefForm />} />
          <Route path="/concours/debrief/:id" element={<DebriefView />} />
          <Route path="/routine" element={<Routine />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/progression" element={<Progress />} />
          <Route path="/seances" element={<Sessions />} />
          <Route path="/profil" element={<Profile />} />
        </Route>
      </Route>
      <Route element={<Protected coach />}>
        <Route path="/coach" element={<CoachLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="cliente/:id" element={<ClientDetail />} />
          <Route path="messages" element={<CoachMessages />} />
          <Route path="inviter" element={<Invite />} />
          <Route path="messages-auto" element={<AutoMessages />} />
          <Route path="reglages" element={<Settings />} />
          <Route path="profil" element={<Profile />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
