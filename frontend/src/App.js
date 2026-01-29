import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";

// Pages
import HomePage from "@/pages/HomePage";
import CharacterSheetPage from "@/pages/CharacterSheetPage";
import CharactersListPage from "@/pages/CharactersListPage";
import { CharacterCreatorWizard } from "@/components/character-creator";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create-character" element={<CharacterCreatorWizard />} />
          <Route path="/character/:characterId" element={<CharacterSheetPage />} />
          <Route path="/characters" element={<CharactersListPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;
