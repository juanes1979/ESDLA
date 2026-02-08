#!/usr/bin/env python3
"""
Script to load locations from the Gondor/Rohan map
Each hex = 4 miles = 6.4 km
Coordinates use a grid system where the map shows approximately:
- X axis: West (0) to East (100)  
- Y axis: South (0) to North (100)

Terrain Types:
- facil (easy): White/Cream hexes - plains, fertile lands
- moderado (moderate): Light green hexes - gentle hills, farmland
- dificil (difficult): Dark green hexes - rough terrain, passes
- muy_dificil (very difficult): Light brown hexes - low mountains
- desalentador (daunting): Orange/Terracotta hexes - dense forests, dangerous
- infranqueable (impassable): Dark brown/red hexes - wastelands, Mordor borders

Land Types (from legend symbols):
- tierras_libres (Free Lands): H symbol - safe populated areas
- fronterizas (Border Lands): branching lines - transition zones
- tierras_salvajes (Wild Lands): P symbol - natural wild areas
- tierras_sombra (Shadow Lands): cross symbol - corrupted areas
- tierras_oscuras (Dark Lands): star/arrow cross - Sauron's domain
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

# Scale: 1 hex = 4 miles = 6.4 km
# Map region: Gondor/Rohan - approximately x: 0-60, y: 0-70 in our coordinate system

GONDOR_ROHAN_LOCATIONS = [
    # === GONDOR - MAJOR CITIES ===
    {
        "nombre": "Minas Tirith",
        "nombre_sindarin": "Minas Anor",
        "region": "Gondor",
        "subregion": "Anórien",
        "tipo": "ciudad_capital",
        "x": 52, "y": 32,
        "descripcion": "La Ciudad de los Reyes, capital de Gondor. Torre blanca visible a millas de distancia.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Osgiliath",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Anórien",
        "tipo": "ruinas",
        "x": 54, "y": 33,
        "descripcion": "Antigua capital de Gondor, ahora en ruinas, dividida por el Gran Río.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_sombra",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Pelargir",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Lebennin",
        "tipo": "ciudad_puerto",
        "x": 50, "y": 22,
        "descripcion": "Gran puerto en el río Anduin, centro de comercio marítimo.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Dol Amroth",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Belfalas",
        "tipo": "ciudad_puerto",
        "x": 38, "y": 20,
        "descripcion": "Ciudad de los Príncipes de Belfalas, puerto élfico antiguo.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Tarnost",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Lamedon",
        "tipo": "ciudad",
        "x": 42, "y": 24,
        "descripcion": "Ciudad importante en Lamedon.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Calembel",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Lamedon",
        "tipo": "ciudad",
        "x": 40, "y": 28,
        "descripcion": "Ciudad junto al río Ciril en Lamedon.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Ethring",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Lamedon",
        "tipo": "ciudad",
        "x": 36, "y": 26,
        "descripcion": "Vado y asentamiento en el río Ringló.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    
    # === GONDOR - STRATEGIC POINTS ===
    {
        "nombre": "Cair Andros",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Anórien",
        "tipo": "fortaleza",
        "x": 54, "y": 38,
        "descripcion": "Isla fortaleza en el Anduin, defensa norte de Minas Tirith.",
        "terreno": "dificil",
        "tipo_tierra": "fronterizas",
        "peligro": "alto",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Amon Din",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Anórien",
        "tipo": "almenaras",
        "x": 48, "y": 34,
        "descripcion": "Primera de las almenaras de Gondor.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_libres",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Eilenach",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Anórien",
        "tipo": "almenaras",
        "x": 44, "y": 36,
        "descripcion": "Segunda almenara, la más alta de todas.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_libres",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Nardol",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Anórien",
        "tipo": "almenaras",
        "x": 42, "y": 38,
        "descripcion": "Tercera almenara de Gondor.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_libres",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Erelas",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Anórien",
        "tipo": "almenaras",
        "x": 40, "y": 40,
        "descripcion": "Cuarta almenara de Gondor.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_libres",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Min-Rimmon",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Anórien",
        "tipo": "almenaras",
        "x": 38, "y": 42,
        "descripcion": "Quinta almenara de Gondor.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_libres",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Calenhad",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Anórien",
        "tipo": "almenaras",
        "x": 36, "y": 44,
        "descripcion": "Sexta almenara de Gondor.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_libres",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Halifirien",
        "nombre_sindarin": None,
        "region": "Gondor/Rohan",
        "subregion": "Anórien/Folde",
        "tipo": "almenaras",
        "x": 34, "y": 46,
        "descripcion": "Última almenara, en la frontera con Rohan. Monte sagrado.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_libres",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === GONDOR - REGIONS ===
    {
        "nombre": "Losarnach",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": None,
        "tipo": "region",
        "x": 48, "y": 28,
        "descripcion": "Región de valles fértiles al sur de Minas Tirith.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Lebennin",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": None,
        "tipo": "region",
        "x": 46, "y": 24,
        "descripcion": "Región de cinco ríos, tierras fértiles.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Belfalas",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": None,
        "tipo": "region",
        "x": 36, "y": 18,
        "descripcion": "Región costera, bahía de Belfalas.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Anfalas",
        "nombre_sindarin": "Langstrand",
        "region": "Gondor",
        "subregion": None,
        "tipo": "region",
        "x": 28, "y": 20,
        "descripcion": "Costa larga, región occidental costera.",
        "terreno": "moderado",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Pinnath Gelin",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": None,
        "tipo": "region",
        "x": 30, "y": 26,
        "descripcion": "Colinas Verdes, región montañosa occidental.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Lamedon",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": None,
        "tipo": "region",
        "x": 38, "y": 26,
        "descripcion": "Valle entre las Montañas Blancas y el mar.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === ITHILIEN ===
    {
        "nombre": "Ithilien del Norte",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Ithilien",
        "tipo": "region",
        "x": 58, "y": 36,
        "descripcion": "Jardín de Gondor, tierra bella pero peligrosa cerca de Mordor.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_sombra",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Ithilien del Sur",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Ithilien",
        "tipo": "region",
        "x": 56, "y": 28,
        "descripcion": "Parte sur de Ithilien, más segura.",
        "terreno": "moderado",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Emyn Arnen",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Ithilien",
        "tipo": "colinas",
        "x": 54, "y": 30,
        "descripcion": "Colinas de Arnen, sede de los Senescales.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    
    # === MORDOR BORDERS ===
    {
        "nombre": "Minas Morgul",
        "nombre_sindarin": "Minas Ithil",
        "region": "Mordor",
        "subregion": None,
        "tipo": "fortaleza_enemiga",
        "x": 60, "y": 32,
        "descripcion": "Torre de la Luna, ahora Torre de la Hechicería. Guarida del Rey Brujo.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "extremo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Cirith Ungol",
        "nombre_sindarin": None,
        "region": "Mordor",
        "subregion": None,
        "tipo": "paso_montaña",
        "x": 62, "y": 30,
        "descripcion": "Paso de la Araña, entrada secreta a Mordor. Guarida de Ella-Laraña.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "extremo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Morannon",
        "nombre_sindarin": "Puerta Negra",
        "region": "Mordor",
        "subregion": None,
        "tipo": "fortaleza_enemiga",
        "x": 60, "y": 42,
        "descripcion": "La Puerta Negra de Mordor, entrada principal fuertemente defendida.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "extremo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Dagorlad",
        "nombre_sindarin": "Llanura de Batalla",
        "region": "Mordor",
        "subregion": None,
        "tipo": "llanura",
        "x": 58, "y": 44,
        "descripcion": "Llanura de la Batalla, donde se libraron grandes guerras.",
        "terreno": "desalentador",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Ciénaga de los Muertos",
        "nombre_sindarin": None,
        "region": "Mordor",
        "subregion": None,
        "tipo": "pantano",
        "x": 56, "y": 46,
        "descripcion": "Pantano fantasmal donde yacen los caídos de la Batalla de Dagorlad.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === ROHAN - MAJOR CITIES ===
    {
        "nombre": "Edoras",
        "nombre_sindarin": None,
        "region": "Rohan",
        "subregion": "Folde Este",
        "tipo": "ciudad_capital",
        "x": 30, "y": 44,
        "descripcion": "Capital de Rohan, donde se alza Meduseld, el Salón Dorado.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Aldburg",
        "nombre_sindarin": None,
        "region": "Rohan",
        "subregion": "Folde",
        "tipo": "ciudad",
        "x": 34, "y": 42,
        "descripcion": "Antigua capital de Rohan, sede del Mariscal del Folde Este.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Helm's Deep",
        "nombre_sindarin": "Aglarond",
        "region": "Rohan",
        "subregion": "Folde Oeste",
        "tipo": "fortaleza",
        "x": 22, "y": 40,
        "descripcion": "El Abismo de Helm, fortaleza inexpugnable con las Cuevas Centelleantes.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_libres",
        "peligro": "medio",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Grimslade",
        "nombre_sindarin": None,
        "region": "Rohan",
        "subregion": "Folde Oeste",
        "tipo": "pueblo",
        "x": 24, "y": 44,
        "descripcion": "Pueblo en el Folde Oeste.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    
    # === ROHAN - REGIONS ===
    {
        "nombre": "Folde Este",
        "nombre_sindarin": "Eastemnet",
        "region": "Rohan",
        "subregion": None,
        "tipo": "region",
        "x": 36, "y": 48,
        "descripcion": "Llanuras orientales de Rohan, tierras de pastoreo.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Folde Oeste",
        "nombre_sindarin": "Westemnet",
        "region": "Rohan",
        "subregion": None,
        "tipo": "region",
        "x": 24, "y": 48,
        "descripcion": "Llanuras occidentales de Rohan.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "El Folde",
        "nombre_sindarin": None,
        "region": "Rohan",
        "subregion": None,
        "tipo": "region",
        "x": 32, "y": 44,
        "descripcion": "Región central de Rohan, corazón del reino.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "El Páramo",
        "nombre_sindarin": "The Wold",
        "region": "Rohan",
        "subregion": None,
        "tipo": "region",
        "x": 40, "y": 52,
        "descripcion": "Tierras altas del noreste de Rohan.",
        "terreno": "moderado",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === ROHAN - STRATEGIC POINTS ===
    {
        "nombre": "Vados del Isen",
        "nombre_sindarin": None,
        "region": "Rohan",
        "subregion": "Brecha de Rohan",
        "tipo": "vado",
        "x": 18, "y": 50,
        "descripcion": "Crucial cruce del río Isen, muy disputado.",
        "terreno": "facil",
        "tipo_tierra": "fronterizas",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Isengard",
        "nombre_sindarin": "Angrenost",
        "region": "Nan Curunír",
        "subregion": None,
        "tipo": "fortaleza",
        "x": 16, "y": 54,
        "descripcion": "Torre de Orthanc, fortaleza de Saruman el Blanco.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_sombra",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Vado de Ent",
        "nombre_sindarin": "Entwade",
        "region": "Rohan",
        "subregion": None,
        "tipo": "vado",
        "x": 38, "y": 50,
        "descripcion": "Vado del río Entaguas.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Bocas del Entaguas",
        "nombre_sindarin": None,
        "region": "Rohan",
        "subregion": None,
        "tipo": "delta",
        "x": 44, "y": 54,
        "descripcion": "Delta donde el Entaguas desemboca en el Anduin.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === FANGORN ===
    {
        "nombre": "Fangorn",
        "nombre_sindarin": "Entwood",
        "region": "Rohan/Gondor",
        "subregion": None,
        "tipo": "bosque_antiguo",
        "x": 28, "y": 56,
        "descripcion": "Bosque de los Ents, antiguo y peligroso para los imprudentes.",
        "terreno": "desalentador",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Colina de Barbol",
        "nombre_sindarin": "Derndingle",
        "region": "Fangorn",
        "subregion": None,
        "tipo": "lugar_especial",
        "x": 26, "y": 58,
        "descripcion": "Lugar de reunión de los Ents.",
        "terreno": "desalentador",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": True,
        "millas_hex": 4
    },
    
    # === EMYN MUIL / ANDUIN ===
    {
        "nombre": "Emyn Muil",
        "nombre_sindarin": None,
        "region": "Rohan/Gondor",
        "subregion": None,
        "tipo": "colinas",
        "x": 50, "y": 50,
        "descripcion": "Colinas laberínticas al este del Anduin.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Amon Hen",
        "nombre_sindarin": "Colina de la Vista",
        "region": "Gondor",
        "subregion": None,
        "tipo": "colina",
        "x": 48, "y": 52,
        "descripcion": "Colina con el Asiento de la Vista, mirador antiguo.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Amon Lhaw",
        "nombre_sindarin": "Colina del Oído",
        "region": "Gondor",
        "subregion": None,
        "tipo": "colina",
        "x": 52, "y": 52,
        "descripcion": "Colina con el Asiento del Oído.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Cascadas de Rauros",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": None,
        "tipo": "cascada",
        "x": 50, "y": 54,
        "descripcion": "Enormes cascadas donde el Anduin cae hacia el sur.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === MONTAÑAS BLANCAS ===
    {
        "nombre": "Montañas Blancas",
        "nombre_sindarin": "Ered Nimrais",
        "region": "Gondor/Rohan",
        "subregion": None,
        "tipo": "cordillera",
        "x": 34, "y": 36,
        "descripcion": "Gran cordillera que separa Gondor de Rohan.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Desfiladero de Tarlang",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Montañas Blancas",
        "tipo": "paso_montaña",
        "x": 36, "y": 30,
        "descripcion": "Paso a través de las Montañas Blancas.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_libres",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Senderos de los Muertos",
        "nombre_sindarin": "Dimholt",
        "region": "Gondor/Rohan",
        "subregion": "Montañas Blancas",
        "tipo": "paso_montaña",
        "x": 28, "y": 38,
        "descripcion": "Camino bajo las montañas, maldito y temido.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_sombra",
        "peligro": "extremo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "El Sagrario",
        "nombre_sindarin": "Dunharrow",
        "region": "Rohan",
        "subregion": "Montañas Blancas",
        "tipo": "refugio",
        "x": 26, "y": 40,
        "descripcion": "Refugio de montaña de los Rohirrim, entrada a los Senderos de los Muertos.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_libres",
        "peligro": "medio",
        "refugio": True,
        "millas_hex": 4
    },
    
    # === RÍOS ===
    {
        "nombre": "Gran Río Anduin",
        "nombre_sindarin": "Anduin",
        "region": "Gondor/Rohan",
        "subregion": None,
        "tipo": "rio",
        "x": 52, "y": 45,
        "descripcion": "El mayor río de la Tierra Media occidental.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Río Isen",
        "nombre_sindarin": None,
        "region": "Rohan",
        "subregion": None,
        "tipo": "rio",
        "x": 18, "y": 48,
        "descripcion": "Río que nace en Isengard y marca la frontera occidental de Rohan.",
        "terreno": "facil",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Río Entaguas",
        "nombre_sindarin": "Onodló",
        "region": "Rohan",
        "subregion": None,
        "tipo": "rio",
        "x": 36, "y": 52,
        "descripcion": "Río que fluye desde Fangorn hacia el Anduin.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Río Nevado",
        "nombre_sindarin": "Snowbourn",
        "region": "Rohan",
        "subregion": None,
        "tipo": "rio",
        "x": 30, "y": 42,
        "descripcion": "Río que fluye desde las Montañas Blancas pasando por Edoras.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === TIERRAS BRUNAS ===
    {
        "nombre": "Tierras Brunas",
        "nombre_sindarin": "Dunland",
        "region": "Eriador",
        "subregion": None,
        "tipo": "region",
        "x": 12, "y": 56,
        "descripcion": "Tierras de los Dunlendinos, hostiles a Rohan.",
        "terreno": "moderado",
        "tipo_tierra": "fronterizas",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Páramos de las Tierras Brunas",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": None,
        "tipo": "paramo",
        "x": 10, "y": 60,
        "descripcion": "Páramos salvajes al norte de las Tierras Brunas.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === COSTAS ===
    {
        "nombre": "Bahía de Belfalas",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": None,
        "tipo": "bahia",
        "x": 40, "y": 12,
        "descripcion": "Gran bahía al sur de Gondor.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Andrast",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": None,
        "tipo": "peninsula",
        "x": 22, "y": 14,
        "descripcion": "Península occidental de Gondor, poco habitada.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Tolfalas",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": None,
        "tipo": "isla",
        "x": 48, "y": 10,
        "descripcion": "Isla en la desembocadura del Anduin.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_libres",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
]


async def load_gondor_locations():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Delete only Gondor/Rohan region locations to avoid duplicates
    regions_to_update = ["Gondor", "Rohan", "Mordor", "Fangorn", "Nan Curunír", "Gondor/Rohan", "Eriador", "Rohan/Gondor"]
    await db.locations.delete_many({"region": {"$in": regions_to_update}})
    
    # Get current max location ID
    last_loc = await db.locations.find_one(sort=[("_id", -1)])
    start_id = 1
    if last_loc:
        try:
            start_id = int(last_loc["_id"].replace("loc_", "")) + 1
        except:
            start_id = 100
    
    # Insert all new locations with generated IDs
    for i, loc in enumerate(GONDOR_ROHAN_LOCATIONS):
        loc["_id"] = f"loc_{start_id + i:03d}"
        loc["created_at"] = datetime.now(timezone.utc).isoformat()
        loc["mapa_origen"] = "Gondor-Rohan-MMS"
    
    result = await db.locations.insert_many(GONDOR_ROHAN_LOCATIONS)
    print(f"Inserted {len(result.inserted_ids)} Gondor/Rohan locations")
    
    # Create indexes
    await db.locations.create_index("region")
    await db.locations.create_index("tipo")
    await db.locations.create_index("nombre")
    await db.locations.create_index("tipo_tierra")
    await db.locations.create_index("terreno")
    
    # Print summary
    print("\n=== LOCATIONS SUMMARY ===")
    
    # Count by region
    pipeline = [
        {"$group": {"_id": "$region", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    regions = await db.locations.aggregate(pipeline).to_list(50)
    print("\nBy Region:")
    for r in regions:
        print(f"  {r['_id']}: {r['count']}")
    
    # Count by terrain type
    pipeline = [
        {"$group": {"_id": "$terreno", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    terrenos = await db.locations.aggregate(pipeline).to_list(50)
    print("\nBy Terrain:")
    for t in terrenos:
        if t['_id']:
            print(f"  {t['_id']}: {t['count']}")
    
    # Count by land type
    pipeline = [
        {"$group": {"_id": "$tipo_tierra", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    tierras = await db.locations.aggregate(pipeline).to_list(50)
    print("\nBy Land Type:")
    for t in tierras:
        if t['_id']:
            print(f"  {t['_id']}: {t['count']}")
    
    total = await db.locations.count_documents({})
    print(f"\nTotal locations in database: {total}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(load_gondor_locations())
