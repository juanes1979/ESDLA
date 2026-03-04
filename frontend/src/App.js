import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { UserProvider } from "@/contexts/UserContext";

// Pages
import HomePage from "@/pages/HomePage";
import CharacterSheetPage from "@/pages/CharacterSheetPage";
import CharactersListPage from "@/pages/CharactersListPage";
import RulesPage from "@/pages/RulesPage";
import InteractiveCharacterSheet from "@/pages/InteractiveCharacterSheet";
import SheetPositionEditor from "@/pages/SheetPositionEditor";
import TravelGenerator from "@/pages/TravelGenerator";
import MiddleEarthMap from "@/pages/MiddleEarthMap";
import FontDemo from "@/pages/FontDemo";
import { CharacterCreatorWizard } from "@/components/character-creator";

function App() {
  return (
    <UserProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/create-character" element={<CharacterCreatorWizard />} />
            <Route path="/character/:characterId" element={<CharacterSheetPage />} />
            <Route path="/character/:characterId/sheet" element={<InteractiveCharacterSheet />} />
            <Route path="/characters" element={<CharactersListPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/sheet-editor" element={<SheetPositionEditor />} />
            <Route path="/travel" element={<TravelGenerator />} />
            <Route path="/map" element={<MiddleEarthMap />} />
            <Route path="/font-demo" element={<FontDemo />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </div>
    </UserProvider>
  );
}

export default App;
