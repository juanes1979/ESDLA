/**
 * CriaturasSinNombre - Rules and generator for Nameless Creatures
 * Based on the official LOTR 5e supplement
 */
import { useState } from 'react';
import { Skull, Dice6, Plus, Sparkles, Save, RefreshCw, ChevronDown, ChevronUp, Eye, Swords, Shield, Heart, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ========== TABLES DATA ==========

const TABLA_REFERENCIA = {
  titulo: ['El daño', 'El azote', 'El horror', 'El terror', 'La profanadora', 'La devoradora', 'La acechadora', 'La cazadora', 'La guardiana', 'La reptante', 'La merodeadora', 'La sigilosa'],
  lugar: ['del abismo', 'de las sombras', 'del pozo', 'del agua', 'de las profundidades', 'de la oscuridad'],
  conocido: ['por los hombres', 'por los elfos', 'por los enanos', 'por los orcos', 'por los Sabios', 'en el saber antiguo']
};

const TABLA_DESCRIPCION = {
  criatura: ['Un murciélago', 'Una araña', 'Un pez', 'Una babosa', 'Un gusano', 'Un ciempiés', 'Un insecto', 'Un crustáceo', 'Un pulpo', 'Un topo', 'Un sapo', 'Un trol'],
  caracteristica: ['de ojos despiadados', 'con grandes cuernos', 'con la piel luminosa', 'con la cabeza enorme', 'con el cuerpo abotargado', 'de un tamaño descomunal']
};

const TABLA_ENCUENTRO = {
  antes: [
    'adviertes un silencio mortal', 'oyes un siniestro siseo', 'oyes un gruñido grave',
    'te topas con los huesos de sus víctimas', 'sientes que tu vello se eriza', 'oyes un grito ensordecedor',
    'descubres sus huellas', 'oyes un grito aterrador', 'percibes un hedor horrendo',
    'sientes una violenta ráfaga de viento', 'oyes un sonido gorjeante', 'sientes un frío terrible'
  ],
  primero: [
    'es una gran sombra, con una forma oscura en medio', 'son sus grandes garras',
    'son sus ojos, que brillan en la oscuridad', 'es su cuerpo flácido y translúcido, como si estuviera compuesto de material gelatinoso',
    'es su gran boca, que se abre y se cierra como si estuviera tratando de respirar',
    'es una gran mandíbula, con colmillos espantosamente parecidos a los dientes humanos',
    'es que ante ella se arrastran enjambres de insectos u otras alimañas',
    'es un largo y sinuoso tentáculo que se desliza hacia ti',
    'son sus enormes colmillos, tan grandes y largos que no puede cerrar la boca',
    'son sus ojos grandes y ciegos', 'son muchos cuernos retorcidos de sucio marfil',
    'es la visión de una hermosa criatura, como un fantasma de la mente'
  ]
};

const TABLA_RUMORES = [
  'Cuando Sauron volvió a tomar Dol Guldur, intentó conseguir la lealtad de las numerosas criaturas oscuras. Algunas se negaron y fueron encarceladas. Cuando el Concilio Blanco atacó, una de esas criaturas seguía allí encadenada...',
  'Cuando Annúminas era joven, los hombres de Arnor despertaron algo monstruoso que llevaba milenios durmiendo en el fondo del Lago del Crepúsculo...',
  'Obligada hace tiempo a servir a Sauron, la criatura luchó en la Batalla de Dagorlad. El propio Gil-galad tuvo que intervenir para ahuyentarla...',
  'Tras la Gran Peste, una gran sombra negra se acercó lentamente al puente de Tharbad, y con un gran estruendo, el puente se desmoronó...',
  'Ohtar, el escudero de Isildur, fue perseguido durante mucho tiempo por una criatura monstruosa que parecía capaz de «oler» sus movimientos...',
  'Fornost no cayó por medios convencionales. El Rey Brujo de Angmar lanzó contra la ciudad una criatura aterradora...',
  'Los enanos mencionaron muchos horrores en las Montañas Grises. Se dice que fue Thorin I quien derrotó a uno de ellos...',
  'Durante mucho tiempo, la criatura permaneció en una profunda cueva. Los hombres de las colinas la adoraban como a un dios...',
  'Hace siglos, la criatura arremetió contra una aldea de los hombres del bosque. No hubo supervivientes...',
  'Una vez cada cierto número de años, la criatura regresa a las Montañas del Bosque Negro, y cientos de arañas huyen enloquecidas...',
  'Esta criatura no codicia tesoros, sino huesos. Siente una gran avidez por los huesos de los elfos...',
  'Cuando Beleriand cayó, muchos seres huyeron. Entre ellos hay una criatura especialmente grande y cruel...'
];

const TABLA_RECUERDOS = [
  'Los orcos odian a las criaturas que se arrastran en la oscuridad. Si la criatura está cerca, hablar con un orco podría resultar útil.',
  'Las grandes águilas ven muchas cosas desde lo alto, pero no hablan de ellas. Solo vigilan en silencio.',
  'Existe una canción élfica que habla de los lamentos de la criatura. Cantarla entera podría evitar que se acerque.',
  'Una inscripción en una cueva dice: «Aquí Belegorn desterró al ser del abismo, pero murió por sus terribles heridas».',
  'En Minas Tirith hay una crónica que habla de una criatura maligna bajo el monte Mindolluin.',
  'Un monumento funerario habla de Crinna, muerto por una criatura terrible que solo podía mantenerse a raya con grandes hogueras.',
  'Los hobbits tienen una rima sobre una criatura hecha de oscuridad que sale del agua y devora a los que miran su reflejo.',
  'Los montaraces hablan de una criatura que puede aparecer a tu lado mientras duermes. Los elfos no la temen, pues nunca duermen...',
  'Saruman guarda silencio sobre su colección de textos relativos a criaturas oscuras. Son demasiadas y demasiado diferentes.',
  'La piedra vidente de las Emyn Beraid solo desvía su mirada del oeste cuando una criatura antigua se acerca a los Puertos Grises.',
  'En la biblioteca de Elrond hay un pergamino enteramente dedicado a la criatura, con indicaciones sobre sus hábitos.',
  'Solo los más sabios saben algo de esta criatura. Y la temen. Darán consejos para huir, no para combatirla.'
];

const TABLA_CARACTERISTICAS = [
  { d20: '15-20', tamanio: 'Enorme', ca: 13, pg: 105, dados: '10d12 + 40', fue: 19, des: 12, con: 18, desafio: 4, bonComp: 2 },
  { d20: '10-14', tamanio: 'Enorme', ca: 14, pg: 138, dados: '12d12 + 60', fue: 21, des: 10, con: 20, desafio: 5, bonComp: 3 },
  { d20: '6-9', tamanio: 'Enorme', ca: 15, pg: 175, dados: '14d12 + 84', fue: 23, des: 8, con: 22, desafio: 7, bonComp: 3 },
  { d20: '4-5', tamanio: 'Enorme', ca: 16, pg: 216, dados: '16d12 + 112', fue: 25, des: 6, con: 24, desafio: 9, bonComp: 4 },
  { d20: '3', tamanio: 'Gargantuesco', ca: 17, pg: 296, dados: '16d20 + 128', fue: 27, des: 4, con: 26, desafio: 13, bonComp: 5 },
  { d20: '2', tamanio: 'Gargantuesco', ca: 18, pg: 351, dados: '18d20 + 162', fue: 29, des: 2, con: 28, desafio: 15, bonComp: 5 },
  { d20: '1', tamanio: 'Gargantuesco', ca: 19, pg: 410, dados: '20d20 + 200', fue: 30, des: 1, con: 30, desafio: 17, bonComp: 6 }
];

const TABLA_ATAQUES = [
  { nombre: 'Golpetazo, cola o tentáculo', tipo: 'contundente', dadoEnorme: '3d4', dadoGargantua: '4d4', alcanceEnorme: '4,5 m', alcanceGargantua: '6 m', efecto: 'agarra e inmoviliza' },
  { nombre: 'Pico, mordisco o cuernos', tipo: 'perforante', dadoEnorme: '3d8', dadoGargantua: '4d8', alcanceEnorme: '1,5 m', alcanceGargantua: '3 m', efecto: 'derriba' },
  { nombre: 'Garras, espolones o colmillos', tipo: 'cortante', dadoEnorme: '3d6', dadoGargantua: '4d6', alcanceEnorme: '3 m', alcanceGargantua: '4,5 m', efecto: 'agarra' }
];

const TABLA_RASGOS = [
  { d20: '1-2', nombre: 'Dureza Temible', descripcion: 'Si sufre 14 PG de daño o menos que la reducirían a 0 PG, queda a 1 PG en su lugar.' },
  { d20: '3-4', nombre: 'Hedor Nauseabundo', descripcion: 'Criaturas a 1,5 m o menos deben superar CON o quedan envenenadas hasta su siguiente turno.' },
  { d20: '5-6', nombre: 'Fuerza Horrible', descripcion: 'Sus ataques infligen un dado de daño adicional.' },
  { d20: '7-8', nombre: 'Veneno', descripcion: 'Su ataque principal causa 3d4 daño por veneno adicional y puede envenenar durante 1 hora.' },
  { d20: '9-10', nombre: 'Ataque Múltiple Mejorado', descripcion: 'Lleva a cabo un ataque adicional con su ataque principal o secundario.' },
  { d20: '11-12', nombre: 'Velocidad Serpentina', descripcion: 'Puede usar Correr o Destrabarse como acción adicional.' },
  { d20: '13-14', nombre: 'Infundir Temor', descripcion: 'Criaturas a 18 m deben superar CAR o quedan asustadas durante 1 minuto.' },
  { d20: '15-16', nombre: 'Habitante de la Oscuridad', descripcion: 'Tiene ventaja en Sigilo en luz tenue/oscuridad y puede Esconderse como acción adicional.' },
  { d20: '17-18', nombre: 'Piel Gruesa', descripcion: 'Resistencia al daño contundente, cortante y perforante de armas no mágicas.' },
  { d20: '19-20', nombre: 'Regeneración', descripcion: 'Recupera 10 PG al inicio de su turno si tiene al menos 1 PG.' }
];

// ========== HELPER FUNCTIONS ==========

const rollD = (max) => Math.floor(Math.random() * max) + 1;
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const getModifier = (value) => {
  const mod = Math.floor((value - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

const generateCreature = () => {
  // Roll for power level (d20)
  const powerRoll = rollD(20);
  let stats;
  if (powerRoll >= 15) stats = TABLA_CARACTERISTICAS[0];
  else if (powerRoll >= 10) stats = TABLA_CARACTERISTICAS[1];
  else if (powerRoll >= 6) stats = TABLA_CARACTERISTICAS[2];
  else if (powerRoll >= 4) stats = TABLA_CARACTERISTICAS[3];
  else if (powerRoll === 3) stats = TABLA_CARACTERISTICAS[4];
  else if (powerRoll === 2) stats = TABLA_CARACTERISTICAS[5];
  else stats = TABLA_CARACTERISTICAS[6];

  // Generate name
  const titulo = pickRandom(TABLA_REFERENCIA.titulo);
  const lugar = pickRandom(TABLA_REFERENCIA.lugar);
  const conocido = pickRandom(TABLA_REFERENCIA.conocido);
  const nombre = `${titulo} ${lugar}`;

  // Generate description
  const criatura = pickRandom(TABLA_DESCRIPCION.criatura);
  const caracteristica = pickRandom(TABLA_DESCRIPCION.caracteristica);
  const descripcionBase = `${criatura} ${caracteristica}`;

  // Generate encounter
  const antes = pickRandom(TABLA_ENCUENTRO.antes);
  const primero = pickRandom(TABLA_ENCUENTRO.primero);

  // Generate lore
  const rumor = pickRandom(TABLA_RUMORES);
  const recuerdo = pickRandom(TABLA_RECUERDOS);

  // Generate attacks (2 different)
  const ataquesDisponibles = [...TABLA_ATAQUES];
  const ataque1Idx = Math.floor(Math.random() * ataquesDisponibles.length);
  const ataque1 = ataquesDisponibles[ataque1Idx];
  ataquesDisponibles.splice(ataque1Idx, 1);
  const ataque2 = pickRandom(ataquesDisponibles);

  // Generate special traits (1-3)
  const numRasgos = rollD(3);
  const rasgosDisponibles = [...TABLA_RASGOS];
  const rasgos = [];
  for (let i = 0; i < numRasgos && rasgosDisponibles.length > 0; i++) {
    const idx = Math.floor(Math.random() * rasgosDisponibles.length);
    rasgos.push(rasgosDisponibles[idx]);
    rasgosDisponibles.splice(idx, 1);
  }

  // Calculate final challenge (base + traits)
  const desafioFinal = stats.desafio + rasgos.length;

  // Build structured creature data
  const isGargantua = stats.tamanio === 'Gargantuesco';
  const attackBonus = stats.bonComp + Math.floor((stats.fue - 10) / 2);
  const escapeDC = 8 + stats.bonComp + Math.floor((stats.fue - 10) / 2);

  return {
    nombre,
    nombreCompleto: `${nombre}, conocid${titulo.startsWith('El') ? 'o' : 'a'} ${conocido}`,
    categoria: 'especiales',
    tipo: `Monstruosidad ${stats.tamanio}`,
    tamanio: stats.tamanio,
    descripcion: `${descripcionBase}. Conocid${titulo.startsWith('El') ? 'o' : 'a'} ${conocido}. ${rumor}`,
    encuentro: { antes, primero },
    recuerdo,
    // Stats
    clase_armadura: stats.ca,
    descripcion_armadura: 'armadura natural',
    puntos_golpe: stats.pg,
    dados_golpe: stats.dados,
    velocidad: 6,
    velocidades_especiales: { excavar: 3, trepar: 6, nadar: 6 },
    atributos: {
      fuerza: stats.fue,
      destreza: stats.des,
      constitucion: stats.con,
      inteligencia: 1,
      sabiduria: 7,
      carisma: 3
    },
    habilidades: { sigilo: stats.bonComp + Math.floor((stats.des - 10) / 2) },
    percepcion_pasiva: 8,
    inmunidades_estados: ['asustado', 'cansancio', 'envenenado', 'hechizado', 'paralizado', 'petrificado'],
    sentidos: ['Visión ciega 36 m'],
    desafio: `${desafioFinal} (${calcXP(desafioFinal)} PX)`,
    experiencia: calcXP(desafioFinal),
    bonificador_competencia: stats.bonComp,
    // Abilities
    especiales: [
      { nombre: 'Anfibio', descripcion: 'Puede respirar aire y agua.' },
      { nombre: 'Sensibilidad a la Luz del Sol', descripcion: 'Mientras está bajo la luz del sol, tiene desventaja en las tiradas de ataque y en las pruebas de Sabiduría (Percepción) basadas en la vista.' },
      ...rasgos.map(r => ({ nombre: r.nombre, descripcion: r.descripcion }))
    ],
    ataque_multiple: 'Lleva a cabo dos ataques: uno con su arma natural principal y otro con su arma natural secundaria.',
    armas: [
      {
        nombre: ataque1.nombre.split(',')[0],
        tipo: 'cuerpo a cuerpo',
        bonificador_impacto: attackBonus,
        alcance_metros: isGargantua ? ataque1.alcanceGargantua : ataque1.alcanceEnorme,
        dano: `${isGargantua ? ataque1.dadoGargantua : ataque1.dadoEnorme} + ${Math.floor((stats.fue - 10) / 2)}`,
        tipo_dano: ataque1.tipo,
        efecto: ataque1.efecto === 'agarra e inmoviliza' 
          ? `El objetivo queda agarrado e inmovilizado (CD ${escapeDC} para escapar).`
          : ataque1.efecto === 'derriba'
          ? `Salvación de Fuerza CD ${escapeDC} o queda derribado.`
          : `El objetivo queda agarrado (CD ${escapeDC} para escapar).`
      },
      {
        nombre: ataque2.nombre.split(',')[0],
        tipo: 'cuerpo a cuerpo',
        bonificador_impacto: attackBonus,
        alcance_metros: isGargantua ? ataque2.alcanceGargantua : ataque2.alcanceEnorme,
        dano: `${isGargantua ? ataque2.dadoGargantua : ataque2.dadoEnorme} + ${Math.floor((stats.fue - 10) / 2)}`,
        tipo_dano: ataque2.tipo,
        efecto: ataque2.efecto === 'agarra e inmoviliza' 
          ? `El objetivo queda agarrado e inmovilizado (CD ${escapeDC} para escapar).`
          : ataque2.efecto === 'derriba'
          ? `Salvación de Fuerza CD ${escapeDC} o queda derribado.`
          : `El objetivo queda agarrado (CD ${escapeDC} para escapar).`
      }
    ],
    powerRoll,
    rasgosExtra: rasgos.length
  };
};

const calcXP = (cr) => {
  const xpByCR = {
    4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
    11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000,
    17: 18000, 18: 20000, 19: 22000, 20: 25000
  };
  return xpByCR[cr] || cr * 1000;
};

// ========== COMPONENT ==========

const CriaturasSinNombreSection = () => {
  const [showRules, setShowRules] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);
  const [creature, setCreature] = useState(null);
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleGenerate = () => {
    const newCreature = generateCreature();
    setCreature(newCreature);
    setCustomName(newCreature.nombre);
    setShowGenerator(true);
  };

  const handleSave = async () => {
    if (!creature) return;
    setSaving(true);
    
    try {
      const dataToSave = {
        ...creature,
        nombre: customName || creature.nombre
      };
      // Remove temporary fields
      delete dataToSave.powerRoll;
      delete dataToSave.rasgosExtra;
      delete dataToSave.encuentro;
      delete dataToSave.recuerdo;
      delete dataToSave.nombreCompleto;

      const response = await fetch(`${API_URL}/api/data/npcs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      });

      if (!response.ok) throw new Error('Error al guardar');
      
      toast.success(`"${customName}" añadida al Bestiario como Especial`);
      setCreature(null);
      setShowGenerator(false);
    } catch (err) {
      toast.error('Error al guardar la criatura');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-[hsl(var(--gold))] mb-2">Criaturas sin Nombre</h2>
        <p className="text-muted-foreground italic">
          "Hay criaturas más antiguas y horribles que los orcos en las profundidades del mundo"
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Button 
          variant={showRules ? 'default' : 'outline'}
          onClick={() => setShowRules(!showRules)}
          className={showRules ? 'bg-[hsl(var(--gold))] text-black' : ''}
        >
          <Eye className="w-4 h-4 mr-2" /> {showRules ? 'Ocultar' : 'Ver'} Reglas
        </Button>
        <Button 
          onClick={handleGenerate}
          className="bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/80"
          data-testid="generate-nameless-creature"
        >
          <Dice6 className="w-4 h-4 mr-2" /> Generar Criatura sin Nombre
        </Button>
      </div>

      {/* Rules Section */}
      {showRules && (
        <div className="space-y-6 p-4 bg-black/20 rounded-lg border border-border/30">
          {/* Intro */}
          <div className="prose prose-invert max-w-none">
            <p className="text-muted-foreground">
              Las leyendas más oscuras de los enanos hablan de criaturas ancestrales que viven en los estanques y lagos de valles remotos, 
              y que acechan en túneles oscuros excavados antes de que los orcos llegaran a las montañas. No parecen creaciones de Morgoth, 
              pues son más antiguas que Sauron. Su maldita estirpe podría ser similar a la de Ungoliant, pero nadie lo sabe con certeza.
            </p>
            <p className="text-muted-foreground">
              Todas tienen un aspecto horrible y son muy peligrosas. No son simples bestias, sino que tienen una inteligencia primitiva. 
              Todas odian la luz, por lo que viven en los recovecos más oscuros de la tierra.
            </p>
          </div>

          {/* Base Stats */}
          <div className="p-4 bg-black/30 rounded border border-[hsl(var(--destructive))]/30">
            <h3 className="text-lg font-bold text-[hsl(var(--destructive))] mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5" /> Características Base
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><strong>Tipo:</strong> Monstruosidad</div>
              <div><strong>Tamaño:</strong> Enorme o Gargantuesco</div>
              <div><strong>Velocidad:</strong> 6m, excavar 3m, trepar 6m, nadar 6m</div>
              <div><strong>INT:</strong> 1 (-5), <strong>SAB:</strong> 7 (-2), <strong>CAR:</strong> 3 (-4)</div>
            </div>
            <div className="mt-3 text-sm">
              <strong>Inmunidades:</strong> asustado, cansancio, envenenado, hechizado, paralizado, petrificado
            </div>
            <div className="mt-2 text-sm">
              <strong>Sentidos:</strong> Visión ciega 36 m, Percepción pasiva 8
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              <strong>Rasgos fijos:</strong> Anfibio, Sensibilidad a la Luz del Sol
            </div>
          </div>

          {/* Table 6: Stats by Power */}
          <div>
            <h3 className="text-lg font-bold text-[hsl(var(--gold))] mb-3">Tabla 6: Características según Poder (d20)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-black/30">
                  <tr>
                    <th className="p-2 text-left">d20</th>
                    <th className="p-2 text-left">Tamaño</th>
                    <th className="p-2 text-center">CA</th>
                    <th className="p-2 text-center">PG</th>
                    <th className="p-2 text-center">FUE</th>
                    <th className="p-2 text-center">DES</th>
                    <th className="p-2 text-center">CON</th>
                    <th className="p-2 text-center">Desafío</th>
                  </tr>
                </thead>
                <tbody>
                  {TABLA_CARACTERISTICAS.map((row, i) => (
                    <tr key={i} className="border-b border-border/20 hover:bg-black/10">
                      <td className="p-2 font-mono">{row.d20}</td>
                      <td className="p-2">{row.tamanio}</td>
                      <td className="p-2 text-center">{row.ca}</td>
                      <td className="p-2 text-center">{row.pg}</td>
                      <td className="p-2 text-center">{row.fue} ({getModifier(row.fue)})</td>
                      <td className="p-2 text-center">{row.des} ({getModifier(row.des)})</td>
                      <td className="p-2 text-center">{row.con} ({getModifier(row.con)})</td>
                      <td className="p-2 text-center">{row.desafio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 7: Attacks */}
          <div>
            <h3 className="text-lg font-bold text-[hsl(var(--destructive))] mb-3 flex items-center gap-2">
              <Swords className="w-5 h-5" /> Tabla 7: Formas de Ataque
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Tira dos veces para determinar un arma natural principal y una secundaria (ignorar duplicados).
            </p>
            <div className="space-y-3">
              {TABLA_ATAQUES.map((ataque, i) => (
                <div key={i} className="p-3 bg-black/20 rounded border border-[hsl(var(--destructive))]/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[hsl(var(--destructive))]">{i + 1}. {ataque.nombre}</span>
                    <Badge variant="outline">{ataque.tipo}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><strong>Daño Enorme:</strong> {ataque.dadoEnorme} + mod FUE</div>
                    <div><strong>Daño Gargantuesco:</strong> {ataque.dadoGargantua} + mod FUE</div>
                    <div><strong>Alcance Enorme:</strong> {ataque.alcanceEnorme}</div>
                    <div><strong>Alcance Gargantuesco:</strong> {ataque.alcanceGargantua}</div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2"><strong>Efecto:</strong> {ataque.efecto}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Table 8: Special Traits */}
          <div>
            <h3 className="text-lg font-bold text-purple-400 mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> Tabla 8: Rasgos Especiales (d20)
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Cada rasgo especial adicional aumenta en 1 el valor de desafío de la criatura.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TABLA_RASGOS.map((rasgo, i) => (
                <div key={i} className="p-3 bg-purple-500/10 rounded border border-purple-500/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-purple-400">{rasgo.nombre}</span>
                    <Badge variant="outline" className="text-purple-400">{rasgo.d20}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{rasgo.descripcion}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Generator Result */}
      {showGenerator && creature && (
        <div className="p-4 bg-[hsl(var(--destructive))]/10 rounded-lg border-2 border-[hsl(var(--destructive))]/50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-[hsl(var(--destructive))]">
              <Skull className="w-5 h-5 inline mr-2" />
              Criatura Generada
            </h3>
            <Button variant="ghost" size="sm" onClick={handleGenerate}>
              <RefreshCw className="w-4 h-4 mr-1" /> Regenerar
            </Button>
          </div>

          {/* Name Input */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground">Nombre</label>
              <Input 
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="bg-black/20 text-lg font-bold"
                placeholder="Nombre de la criatura"
              />
            </div>
            <Button 
              onClick={handleSave}
              disabled={saving}
              className="bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80"
              data-testid="save-nameless-creature"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar en Bestiario'}
            </Button>
          </div>

          {/* Description */}
          <div className="p-3 bg-black/20 rounded">
            <p className="text-muted-foreground italic">{creature.descripcion}</p>
          </div>

          {/* Encounter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 bg-black/20 rounded">
              <p className="text-xs text-[hsl(var(--gold))] font-bold mb-1">Antes de verla...</p>
              <p className="text-sm">{creature.encuentro.antes}</p>
            </div>
            <div className="p-3 bg-black/20 rounded">
              <p className="text-xs text-[hsl(var(--gold))] font-bold mb-1">Lo primero que ves...</p>
              <p className="text-sm">{creature.encuentro.primero}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-[hsl(var(--magic-blue))]/10 p-3 rounded text-center">
              <Shield className="w-5 h-5 mx-auto text-[hsl(var(--magic-blue))]" />
              <p className="text-xs text-muted-foreground">CA</p>
              <p className="text-xl font-bold text-[hsl(var(--magic-blue))]">{creature.clase_armadura}</p>
            </div>
            <div className="bg-red-500/10 p-3 rounded text-center">
              <Heart className="w-5 h-5 mx-auto text-red-400" />
              <p className="text-xs text-muted-foreground">PG</p>
              <p className="text-xl font-bold text-red-400">{creature.puntos_golpe}</p>
              <p className="text-xs text-muted-foreground">{creature.dados_golpe}</p>
            </div>
            <div className="bg-yellow-500/10 p-3 rounded text-center">
              <Zap className="w-5 h-5 mx-auto text-yellow-400" />
              <p className="text-xs text-muted-foreground">Velocidad</p>
              <p className="text-lg font-bold text-yellow-400">{creature.velocidad}m</p>
            </div>
            <div className="bg-[hsl(var(--gold))]/10 p-3 rounded text-center">
              <Sparkles className="w-5 h-5 mx-auto text-[hsl(var(--gold))]" />
              <p className="text-xs text-muted-foreground">Desafío</p>
              <p className="text-lg font-bold text-[hsl(var(--gold))]">{creature.desafio.split(' ')[0]}</p>
            </div>
            <div className="bg-purple-500/10 p-3 rounded text-center">
              <Skull className="w-5 h-5 mx-auto text-purple-400" />
              <p className="text-xs text-muted-foreground">Tamaño</p>
              <p className="text-lg font-bold text-purple-400">{creature.tamanio}</p>
            </div>
          </div>

          {/* Attributes */}
          <div className="grid grid-cols-6 gap-2">
            {[
              { key: 'fuerza', abbr: 'FUE', color: 'red' },
              { key: 'destreza', abbr: 'DES', color: 'green' },
              { key: 'constitucion', abbr: 'CON', color: 'orange' },
              { key: 'inteligencia', abbr: 'INT', color: 'blue' },
              { key: 'sabiduria', abbr: 'SAB', color: 'purple' },
              { key: 'carisma', abbr: 'CAR', color: 'pink' }
            ].map(attr => (
              <div key={attr.key} className={`bg-${attr.color}-500/10 p-2 rounded text-center`}>
                <p className={`text-xs text-${attr.color}-400 font-bold`}>{attr.abbr}</p>
                <p className="text-lg font-bold">{creature.atributos[attr.key]}</p>
                <p className={`text-xs text-${attr.color}-400`}>
                  {getModifier(creature.atributos[attr.key])}
                </p>
              </div>
            ))}
          </div>

          {/* Special Abilities */}
          <div>
            <p className="text-sm font-bold text-purple-400 mb-2">Habilidades Especiales ({creature.especiales.length})</p>
            <div className="space-y-2">
              {creature.especiales.map((esp, i) => (
                <div key={i} className="p-2 bg-purple-500/10 rounded">
                  <span className="font-semibold text-purple-300">{esp.nombre}:</span>
                  <span className="text-sm text-muted-foreground ml-2">{esp.descripcion}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Attacks */}
          <div>
            <p className="text-sm font-bold text-[hsl(var(--destructive))] mb-2">Ataques</p>
            <p className="text-sm text-muted-foreground mb-2">{creature.ataque_multiple}</p>
            <div className="space-y-2">
              {creature.armas.map((arma, i) => (
                <div key={i} className="p-2 bg-[hsl(var(--destructive))]/10 rounded">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[hsl(var(--destructive))]">{arma.nombre}</span>
                    <Badge variant="outline">{arma.tipo_dano}</Badge>
                  </div>
                  <div className="text-sm mt-1">
                    <span>+{arma.bonificador_impacto} al impacto, </span>
                    <span>alcance {arma.alcance_metros}, </span>
                    <span className="font-bold">{arma.dano}</span>
                  </div>
                  {arma.efecto && <p className="text-xs text-muted-foreground mt-1">{arma.efecto}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Lore */}
          <div className="p-3 bg-black/30 rounded border border-[hsl(var(--gold))]/20">
            <p className="text-xs text-[hsl(var(--gold))] font-bold mb-1">Dónde se recuerda a la criatura:</p>
            <p className="text-sm text-muted-foreground italic">{creature.recuerdo}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CriaturasSinNombreSection;
