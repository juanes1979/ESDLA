/**
 * Font Demo Page - Preview different Tolkien-style fonts
 */
import { useNavigate } from 'react-router-dom';

const FontDemo = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      backgroundImage: 'url(https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/j31eritq_Fondo.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      <div className="absolute inset-0 bg-black/70" />
      
      <div className="relative z-10 container mx-auto px-4 py-12">
        <button 
          onClick={() => navigate('/')}
          className="mb-8 text-orange-400 hover:text-orange-300 transition-colors"
        >
          ← Volver al inicio
        </button>
        
        <h1 className="text-3xl text-orange-400 mb-12 text-center">
          Comparativa de Fuentes Tolkien
        </h1>
        
        {/* Font 1: Aniron */}
        <div className="mb-16 p-8 bg-black/50 rounded-xl border border-orange-500/30">
          <h2 className="text-orange-300 mb-4 text-lg">1. ANIRON (La de las películas de LOTR)</h2>
          <div style={{ fontFamily: 'Aniron, serif' }}>
            <p className="text-4xl text-white mb-4">El Señor de los Anillos</p>
            <p className="text-2xl text-gray-300 mb-4">Crear Personaje | Mis Personajes | Reglas</p>
            <p className="text-xl text-gray-400">La Tierra Media te espera para vivir grandes aventuras</p>
            <div className="mt-4 flex gap-4">
              <button className="px-6 py-2 bg-orange-600 text-white rounded text-lg">Guardar</button>
              <button className="px-6 py-2 bg-gray-700 text-white rounded text-lg">Cancelar</button>
            </div>
          </div>
        </div>
        
        {/* Font 2: Ringbearer */}
        <div className="mb-16 p-8 bg-black/50 rounded-xl border border-orange-500/30">
          <h2 className="text-orange-300 mb-4 text-lg">2. RINGBEARER (Estilo élfico/anillo)</h2>
          <div style={{ fontFamily: 'Ringbearer, serif' }}>
            <p className="text-4xl text-white mb-4">El Señor de los Anillos</p>
            <p className="text-2xl text-gray-300 mb-4">Crear Personaje | Mis Personajes | Reglas</p>
            <p className="text-xl text-gray-400">La Tierra Media te espera para vivir grandes aventuras</p>
            <div className="mt-4 flex gap-4">
              <button className="px-6 py-2 bg-orange-600 text-white rounded text-lg">Guardar</button>
              <button className="px-6 py-2 bg-gray-700 text-white rounded text-lg">Cancelar</button>
            </div>
          </div>
        </div>
        
        {/* Font 3: Bilbo */}
        <div className="mb-16 p-8 bg-black/50 rounded-xl border border-orange-500/30">
          <h2 className="text-orange-300 mb-4 text-lg">3. BILBO (Manuscrita hobbit)</h2>
          <div style={{ fontFamily: 'Bilbo, cursive' }}>
            <p className="text-5xl text-white mb-4">El Señor de los Anillos</p>
            <p className="text-3xl text-gray-300 mb-4">Crear Personaje | Mis Personajes | Reglas</p>
            <p className="text-2xl text-gray-400">La Tierra Media te espera para vivir grandes aventuras</p>
            <div className="mt-4 flex gap-4">
              <button className="px-6 py-2 bg-orange-600 text-white rounded text-xl">Guardar</button>
              <button className="px-6 py-2 bg-gray-700 text-white rounded text-xl">Cancelar</button>
            </div>
          </div>
        </div>
        
        {/* Font 4: Elvish Ring NFI */}
        <div className="mb-16 p-8 bg-black/50 rounded-xl border border-orange-500/30">
          <h2 className="text-orange-300 mb-4 text-lg">4. CINZEL DECORATIVE (Alternativa elegante disponible en Google Fonts)</h2>
          <div style={{ fontFamily: 'Cinzel Decorative, serif' }}>
            <p className="text-4xl text-white mb-4">El Señor de los Anillos</p>
            <p className="text-2xl text-gray-300 mb-4">Crear Personaje | Mis Personajes | Reglas</p>
            <p className="text-xl text-gray-400">La Tierra Media te espera para vivir grandes aventuras</p>
            <div className="mt-4 flex gap-4">
              <button className="px-6 py-2 bg-orange-600 text-white rounded text-lg">Guardar</button>
              <button className="px-6 py-2 bg-gray-700 text-white rounded text-lg">Cancelar</button>
            </div>
          </div>
        </div>
        
        {/* Font 5: Current font with medieval style */}
        <div className="mb-16 p-8 bg-black/50 rounded-xl border border-orange-500/30">
          <h2 className="text-orange-300 mb-4 text-lg">5. UNCIAL ANTIQUA (Medieval céltico)</h2>
          <div style={{ fontFamily: 'Uncial Antiqua, serif' }}>
            <p className="text-4xl text-white mb-4">El Señor de los Anillos</p>
            <p className="text-2xl text-gray-300 mb-4">Crear Personaje | Mis Personajes | Reglas</p>
            <p className="text-xl text-gray-400">La Tierra Media te espera para vivir grandes aventuras</p>
            <div className="mt-4 flex gap-4">
              <button className="px-6 py-2 bg-orange-600 text-white rounded text-lg">Guardar</button>
              <button className="px-6 py-2 bg-gray-700 text-white rounded text-lg">Cancelar</button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Load fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Uncial+Antiqua&display=swap');
        
        @font-face {
          font-family: 'Aniron';
          src: url('https://db.onlinewebfonts.com/t/1f94ed6ea6e5d4e2bff50532a9b0b8c2.woff2') format('woff2');
          font-weight: normal;
          font-style: normal;
        }
        
        @font-face {
          font-family: 'Ringbearer';
          src: url('https://db.onlinewebfonts.com/t/97e85ec71bc3c57e155e8108489de673.woff2') format('woff2');
          font-weight: normal;
          font-style: normal;
        }
        
        @font-face {
          font-family: 'Bilbo';
          src: url('https://fonts.gstatic.com/s/bilbo/v20/o-0EIpgpwWwZ210hpIRz4wxE.woff2') format('woff2');
          font-weight: normal;
          font-style: normal;
        }
      `}</style>
    </div>
  );
};

export default FontDemo;
