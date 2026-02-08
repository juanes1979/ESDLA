#!/usr/bin/env python3
"""
Script to load locations from the Eriador map
Each hex = 4 miles = 6.4 km
This is the northwest region - connects to the west of the Gondor/Rohan map

Coordinate system: Eriador is to the northwest, so lower X values (west) and higher Y values (north)
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

ERIADOR_LOCATIONS = [
    # === LA COMARCA (THE SHIRE) ===
    {
        "nombre": "La Comarca",
        "nombre_sindarin": "Sûza",
        "region": "Eriador",
        "subregion": "La Comarca",
        "tipo": "region",
        "x": 18, "y": 58,
        "descripcion": "Hogar de los Hobbits, tierra verde y pacífica.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Hobbiton",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": "La Comarca",
        "tipo": "pueblo",
        "x": 17, "y": 58,
        "descripcion": "Pueblo hobbit donde está Bolsón Cerrado, hogar de Bilbo y Frodo.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Cavada Grande",
        "nombre_sindarin": "Michel Delving",
        "region": "Eriador",
        "subregion": "La Comarca",
        "tipo": "pueblo",
        "x": 14, "y": 58,
        "descripcion": "Capital de La Comarca, sede del Alcalde.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Delagua",
        "nombre_sindarin": "Bywater",
        "region": "Eriador",
        "subregion": "La Comarca",
        "tipo": "pueblo",
        "x": 18, "y": 57,
        "descripcion": "Pueblo hobbit cerca del estanque de Delagua.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Los Gamos",
        "nombre_sindarin": "Buckland",
        "region": "Eriador",
        "subregion": "La Comarca",
        "tipo": "region",
        "x": 22, "y": 56,
        "descripcion": "Región al este del Brandivino, hogar de los Brandigamo.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Cricava",
        "nombre_sindarin": "Crickhollow",
        "region": "Eriador",
        "subregion": "Los Gamos",
        "tipo": "pueblo",
        "x": 23, "y": 56,
        "descripcion": "Casa donde Frodo fingió mudarse antes de partir.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    
    # === BREE-LAND ===
    {
        "nombre": "Bree",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": "Tierra de Bree",
        "tipo": "pueblo",
        "x": 26, "y": 56,
        "descripcion": "Encrucijada de caminos, hogar del Poney Pisador. Hobbits y Hombres conviven.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Archet",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": "Tierra de Bree",
        "tipo": "pueblo",
        "x": 27, "y": 58,
        "descripcion": "Pequeño pueblo al norte de Bree.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Combe",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": "Tierra de Bree",
        "tipo": "pueblo",
        "x": 27, "y": 55,
        "descripcion": "Pueblo en el valle cerca de Bree.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Staddle",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": "Tierra de Bree",
        "tipo": "pueblo",
        "x": 28, "y": 56,
        "descripcion": "Pueblo hobbit en las laderas de la Colina de Bree.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    
    # === BOSQUE VIEJO ===
    {
        "nombre": "Bosque Viejo",
        "nombre_sindarin": "Old Forest",
        "region": "Eriador",
        "subregion": None,
        "tipo": "bosque_antiguo",
        "x": 24, "y": 54,
        "descripcion": "Bosque antiguo y peligroso al este de La Comarca. Los árboles se mueven.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Casa de Tom Bombadil",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": "Bosque Viejo",
        "tipo": "refugio",
        "x": 25, "y": 52,
        "descripcion": "Hogar de Tom Bombadil y Baya de Oro, refugio seguro.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Quebradas de los Túmulos",
        "nombre_sindarin": "Barrow-downs",
        "region": "Eriador",
        "subregion": None,
        "tipo": "colinas_malditas",
        "x": 26, "y": 52,
        "descripcion": "Colinas con túmulos de los antiguos reyes, habitadas por Tumularios.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_sombra",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === PUERTOS GRISES Y COSTA ===
    {
        "nombre": "Puertos Grises",
        "nombre_sindarin": "Mithlond",
        "region": "Eriador",
        "subregion": "Lindon",
        "tipo": "puerto",
        "x": 6, "y": 52,
        "descripcion": "Puerto élfico desde donde parten los Elfos hacia Valinor.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Lindon",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": None,
        "tipo": "region",
        "x": 8, "y": 56,
        "descripcion": "Reino élfico en la costa, gobernado por Círdan el Carpintero de Barcos.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Forlindon",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": "Lindon",
        "tipo": "region",
        "x": 6, "y": 62,
        "descripcion": "Región norte de Lindon, al norte del Golfo de Lune.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Harlindon",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": "Lindon",
        "tipo": "region",
        "x": 6, "y": 48,
        "descripcion": "Región sur de Lindon, al sur del Golfo de Lune.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === RIVENDEL Y ALREDEDORES ===
    {
        "nombre": "Rivendel",
        "nombre_sindarin": "Imladris",
        "region": "Eriador",
        "subregion": None,
        "tipo": "refugio_elfico",
        "x": 38, "y": 60,
        "descripcion": "La Última Casa Amiga al este del Mar. Hogar de Elrond.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Vado de Bruinen",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": None,
        "tipo": "vado",
        "x": 36, "y": 58,
        "descripcion": "Vado del río Bruinen, protegido por el poder de Elrond.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_libres",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === TIERRAS SOLITARIAS ===
    {
        "nombre": "Cima de los Vientos",
        "nombre_sindarin": "Amon Sûl",
        "region": "Eriador",
        "subregion": "Tierras Solitarias",
        "tipo": "ruinas",
        "x": 32, "y": 56,
        "descripcion": "Antigua torre de vigilancia, ahora en ruinas. Donde Frodo fue herido.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Tierras Solitarias",
        "nombre_sindarin": "Lone-lands",
        "region": "Eriador",
        "subregion": None,
        "tipo": "region",
        "x": 30, "y": 58,
        "descripcion": "Extensas tierras despobladas entre Bree y Rivendel.",
        "terreno": "moderado",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "El Último Puente",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": "Tierras Solitarias",
        "tipo": "puente",
        "x": 34, "y": 56,
        "descripcion": "Antiguo puente sobre el río Sonorona.",
        "terreno": "facil",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === ARNOR RUINS ===
    {
        "nombre": "Annúminas",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": "Arnor",
        "tipo": "ruinas",
        "x": 18, "y": 68,
        "descripcion": "Antigua capital de Arnor junto al lago Evendim, ahora en ruinas.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Fornost",
        "nombre_sindarin": "Fornost Erain",
        "region": "Eriador",
        "subregion": "Arnor",
        "tipo": "ruinas",
        "x": 22, "y": 70,
        "descripcion": "Antigua capital de Arthedain, destruida por Angmar. Las Colinas del Norte.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Lago Evendim",
        "nombre_sindarin": "Nenuial",
        "region": "Eriador",
        "subregion": "Arnor",
        "tipo": "lago",
        "x": 16, "y": 68,
        "descripcion": "Gran lago donde nacía el río Baranduin.",
        "terreno": "facil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === ANGMAR ===
    {
        "nombre": "Angmar",
        "nombre_sindarin": None,
        "region": "Angmar",
        "subregion": None,
        "tipo": "region_maldita",
        "x": 32, "y": 78,
        "descripcion": "Antiguo reino del Rey Brujo, tierra de mal.",
        "terreno": "desalentador",
        "tipo_tierra": "tierras_sombra",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Carn Dûm",
        "nombre_sindarin": None,
        "region": "Angmar",
        "subregion": None,
        "tipo": "fortaleza_abandonada",
        "x": 34, "y": 80,
        "descripcion": "Capital de Angmar, fortaleza del Rey Brujo. Ahora maldita y abandonada.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "extremo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Monte Gundabad",
        "nombre_sindarin": None,
        "region": "Angmar",
        "subregion": None,
        "tipo": "fortaleza_enemiga",
        "x": 40, "y": 82,
        "descripcion": "Antigua montaña sagrada de los Enanos, tomada por los Orcos.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_sombra",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === PÁRAMOS DE LOS TROLLS ===
    {
        "nombre": "Páramos de Etten",
        "nombre_sindarin": "Ettenmoors",
        "region": "Eriador",
        "subregion": None,
        "tipo": "paramo",
        "x": 34, "y": 70,
        "descripcion": "Tierras altas infestadas de trolls al norte de Rivendel.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Bosque de los Trolls",
        "nombre_sindarin": "Trollshaws",
        "region": "Eriador",
        "subregion": None,
        "tipo": "bosque",
        "x": 36, "y": 60,
        "descripcion": "Bosque donde Bilbo encontró a los tres trolls de piedra.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Trolls de Piedra",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": "Trollshaws",
        "tipo": "monumento",
        "x": 35, "y": 59,
        "descripcion": "Tom, Berto y Guille, los trolls convertidos en piedra por Gandalf.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === MONTAÑAS AZULES ===
    {
        "nombre": "Montañas Azules",
        "nombre_sindarin": "Ered Luin",
        "region": "Eriador",
        "subregion": None,
        "tipo": "cordillera",
        "x": 8, "y": 58,
        "descripcion": "Cordillera al oeste de Eriador, hogar de colonias enanas.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Thorin's Halls",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": "Montañas Azules",
        "tipo": "asentamiento_enano",
        "x": 10, "y": 60,
        "descripcion": "Salones de los Enanos de Thorin en las Montañas Azules.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    
    # === MONTAÑAS NUBLADAS ===
    {
        "nombre": "Montañas Nubladas",
        "nombre_sindarin": "Hithaeglir",
        "region": "Eriador",
        "subregion": None,
        "tipo": "cordillera",
        "x": 42, "y": 64,
        "descripcion": "Gran cordillera que separa Eriador de Rhovanion.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Paso Alto",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": "Montañas Nubladas",
        "tipo": "paso_montaña",
        "x": 42, "y": 66,
        "descripcion": "Paso de montaña usado por Bilbo, peligroso pero transitable.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Ciudad de los Trasgos",
        "nombre_sindarin": "Goblin-town",
        "region": "Eriador",
        "subregion": "Montañas Nubladas",
        "tipo": "fortaleza_enemiga",
        "x": 42, "y": 68,
        "descripcion": "Ciudad subterránea de los trasgos bajo las Montañas Nubladas.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_sombra",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Paso de Caradhras",
        "nombre_sindarin": "Redhorn Pass",
        "region": "Eriador",
        "subregion": "Montañas Nubladas",
        "tipo": "paso_montaña",
        "x": 42, "y": 52,
        "descripcion": "Paso del Cuerno Rojo, donde la Comunidad intentó cruzar.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Moria",
        "nombre_sindarin": "Khazad-dûm",
        "region": "Eriador",
        "subregion": "Montañas Nubladas",
        "tipo": "mina_abandonada",
        "x": 42, "y": 50,
        "descripcion": "Antiguo reino enano, ahora infestado de orcos y el Balrog.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_sombra",
        "peligro": "extremo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Puerta Oeste de Moria",
        "nombre_sindarin": "Hollin Gate",
        "region": "Eriador",
        "subregion": "Eregion",
        "tipo": "puerta",
        "x": 40, "y": 50,
        "descripcion": "Puerta de Durin, entrada oeste a Moria junto al estanque del Guardián.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_sombra",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === EREGION (HOLLIN) ===
    {
        "nombre": "Eregion",
        "nombre_sindarin": "Hollin",
        "region": "Eriador",
        "subregion": None,
        "tipo": "region",
        "x": 38, "y": 50,
        "descripcion": "Antigua tierra de los Elfos herreros, ahora despoblada pero bella.",
        "terreno": "moderado",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Ost-in-Edhil",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": "Eregion",
        "tipo": "ruinas",
        "x": 38, "y": 52,
        "descripcion": "Ruinas de la capital de Eregion, donde Celebrimbor forjó los anillos.",
        "terreno": "moderado",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === MINHIRIATH Y SUR ===
    {
        "nombre": "Minhiriath",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": None,
        "tipo": "region",
        "x": 20, "y": 44,
        "descripcion": "Región despoblada entre los ríos Baranduin y Grisáurea.",
        "terreno": "moderado",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Tharbad",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": "Minhiriath",
        "tipo": "ruinas",
        "x": 28, "y": 42,
        "descripcion": "Ciudad en ruinas junto al río Grisáurea, antiguo vado importante.",
        "terreno": "moderado",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Sarn Ford",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": None,
        "tipo": "vado",
        "x": 20, "y": 50,
        "descripcion": "Vado del Baranduin al sur de La Comarca, vigilado por los Montaraces.",
        "terreno": "facil",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === RÍOS ===
    {
        "nombre": "Río Brandivino",
        "nombre_sindarin": "Baranduin",
        "region": "Eriador",
        "subregion": None,
        "tipo": "rio",
        "x": 20, "y": 56,
        "descripcion": "Río que marca la frontera este de La Comarca.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Río Bruinen",
        "nombre_sindarin": "Loudwater",
        "region": "Eriador",
        "subregion": None,
        "tipo": "rio",
        "x": 36, "y": 56,
        "descripcion": "Río que protege Rivendel, sus aguas pueden alzarse contra los enemigos.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Río Sonorona",
        "nombre_sindarin": "Mitheithel",
        "region": "Eriador",
        "subregion": None,
        "tipo": "rio",
        "x": 32, "y": 54,
        "descripcion": "Río que cruza las Tierras Solitarias.",
        "terreno": "facil",
        "tipo_tierra": "fronterizas",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Río Grisáurea",
        "nombre_sindarin": "Greyflood",
        "region": "Eriador",
        "subregion": None,
        "tipo": "rio",
        "x": 26, "y": 44,
        "descripcion": "Gran río del sur de Eriador, unión del Sonorona y el Fontegris.",
        "terreno": "facil",
        "tipo_tierra": "fronterizas",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === CAMINOS ===
    {
        "nombre": "Gran Camino del Este",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": None,
        "tipo": "camino",
        "x": 28, "y": 56,
        "descripcion": "Antiguo camino que conecta La Comarca con Rivendel.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Camino Verde",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": None,
        "tipo": "camino",
        "x": 22, "y": 48,
        "descripcion": "Antiguo camino del norte que conectaba Fornost con el sur.",
        "terreno": "moderado",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === PÁRAMOS DEL NORTE ===
    {
        "nombre": "Páramos del Norte",
        "nombre_sindarin": "North Downs",
        "region": "Eriador",
        "subregion": None,
        "tipo": "region",
        "x": 24, "y": 66,
        "descripcion": "Colinas al norte de Bree, tierras salvajes despobladas.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Colinas del Viento",
        "nombre_sindarin": "Weather Hills",
        "region": "Eriador",
        "subregion": None,
        "tipo": "colinas",
        "x": 30, "y": 58,
        "descripcion": "Colinas donde se alza Amon Sûl.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Colinas de Evendim",
        "nombre_sindarin": None,
        "region": "Eriador",
        "subregion": None,
        "tipo": "colinas",
        "x": 18, "y": 66,
        "descripcion": "Colinas alrededor del lago Evendim.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === PANTANO DE MOSCAGUA ===
    {
        "nombre": "Pantano de Moscagua",
        "nombre_sindarin": "Midgewater Marshes",
        "region": "Eriador",
        "subregion": None,
        "tipo": "pantano",
        "x": 28, "y": 58,
        "descripcion": "Pantanos infestados de mosquitos entre Bree y las Colinas del Viento.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
]


async def load_eriador_locations():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Get current max location ID
    last_loc = await db.locations.find_one(sort=[("_id", -1)])
    start_id = 1
    if last_loc:
        try:
            start_id = int(last_loc["_id"].replace("loc_", "")) + 1
        except:
            start_id = 300
    
    # Check for duplicates and skip them
    new_locations = []
    for loc in ERIADOR_LOCATIONS:
        existing = await db.locations.find_one({"nombre": loc["nombre"]})
        if not existing:
            loc["_id"] = f"loc_{start_id + len(new_locations):03d}"
            loc["created_at"] = datetime.now(timezone.utc).isoformat()
            loc["mapa_origen"] = "Eriador-MMS"
            new_locations.append(loc)
        else:
            print(f"  Skipping duplicate: {loc['nombre']}")
    
    if new_locations:
        result = await db.locations.insert_many(new_locations)
        print(f"Inserted {len(result.inserted_ids)} Eriador locations")
    else:
        print("No new locations to insert")
    
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
    
    total = await db.locations.count_documents({})
    print(f"\nTotal locations in database: {total}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(load_eriador_locations())
