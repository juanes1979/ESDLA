import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { UserProvider } from "@/contexts/UserContext";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

// Pages
import HomePage from "@/pages/HomePage";
import CharacterSheetPage from "@/pages/CharacterSheetPage";
import CharactersListPage from "@/pages/CharactersListPage";
import RulesPage from "@/pages/RulesPage";
import InteractiveCharacterSheet from "@/pages/InteractiveCharacterSheet";
import SheetPositionEditor from "@/pages/SheetPositionEditor";
import TravelGenerator from "@/pages/TravelGenerator";
import EnhancedTravelSystem from "@/pages/EnhancedTravelSystem";
import TravelErrorBoundary from "@/components/travel/TravelErrorBoundary";
import MiddleEarthMap from "@/pages/MiddleEarthMap";
import MapSelectionPage from "@/pages/MapSelectionPage";
import PlayerMap from "@/pages/PlayerMap";
import FontDemo from "@/pages/FontDemo";
import StoragePage from "@/pages/StoragePage";
import AdminBackupPage from "@/pages/AdminBackupPage";
import TerrainEditor from "@/pages/TerrainEditor";
import PathDebugger from "@/pages/PathDebugger";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ApprovalsPage from "@/pages/ApprovalsPage";
import { CharacterCreatorWizard } from "@/components/character-creator";

// Role groups
const STAFF = ["maestro", "director_de_juego"];

function App() {
  return (
    <AuthProvider>
      <UserProvider>
        <div className="App">
          <BrowserRouter>
            <Routes>
              {/* Public auth routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Authenticated routes (any role) */}
              <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
              <Route path="/create-character" element={<ProtectedRoute><CharacterCreatorWizard /></ProtectedRoute>} />
              <Route path="/character/:characterId" element={<ProtectedRoute><CharacterSheetPage /></ProtectedRoute>} />
              <Route path="/character/:characterId/sheet" element={<ProtectedRoute><InteractiveCharacterSheet /></ProtectedRoute>} />
              <Route path="/characters" element={<ProtectedRoute><CharactersListPage /></ProtectedRoute>} />
              <Route path="/travel" element={<ProtectedRoute><TravelErrorBoundary><EnhancedTravelSystem /></TravelErrorBoundary></ProtectedRoute>} />
              <Route path="/travel/legacy" element={<ProtectedRoute><TravelGenerator /></ProtectedRoute>} />
              <Route path="/map" element={<ProtectedRoute><MapSelectionPage /></ProtectedRoute>} />
              <Route path="/map/player" element={<ProtectedRoute><PlayerMap /></ProtectedRoute>} />
              <Route path="/font-demo" element={<ProtectedRoute><FontDemo /></ProtectedRoute>} />
              <Route path="/storage" element={<ProtectedRoute><StoragePage /></ProtectedRoute>} />

              {/* Staff-only routes (Maestro + Director de Juego) */}
              <Route path="/rules" element={<ProtectedRoute roles={STAFF}><RulesPage /></ProtectedRoute>} />
              <Route path="/sheet-editor" element={<ProtectedRoute roles={STAFF}><SheetPositionEditor /></ProtectedRoute>} />
              <Route path="/map/master" element={<ProtectedRoute roles={STAFF}><MiddleEarthMap /></ProtectedRoute>} />
              <Route path="/terrain-editor" element={<ProtectedRoute roles={STAFF}><TerrainEditor /></ProtectedRoute>} />
              <Route path="/path-debugger" element={<ProtectedRoute roles={STAFF}><PathDebugger /></ProtectedRoute>} />

              {/* Maestro-only routes */}
              <Route path="/admin/backup" element={<ProtectedRoute roles={["maestro"]}><AdminBackupPage /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute roles={["maestro"]}><ApprovalsPage /></ProtectedRoute>} />
            </Routes>
          </BrowserRouter>
          <Toaster />
        </div>
      </UserProvider>
    </AuthProvider>
  );
}

export default App;
