#!/usr/bin/env python3
"""
Script para actualizar los datos de reglas en MongoDB:
- Artes (descripciones completas)
- Recompensas (bendiciones completas)
- Salarios (nueva colección)
- Varios (pruebas de habilidad, cansancio, inspiración, ojo de mordor, ventaja)
- Combate (nueva regla)
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "lotr5e")

# ARTES - Descripciones completas
ARTES_DATA = [
    {
        "nombre": "Arte de la fabricación",
        "descripcion_corta": "Talento para fabricar cosas con habilidad y astucia superiores.",
        "descripcion": """Este arte no pretende abarcar toda la gama de aptitudes de los herreros, escultores y otros artesanos, sino que refleja un talento para fabricar cosas con habilidad y astucia superiores. Durante una fase de comunidad, puedes gastar un espacio de arte y elegir un objeto no mágico que poseas. Debes dominar las herramientas relacionadas con el objeto que elijas, y puede que también necesites acceso a materiales o lugares especiales, como una forja. Si un rasgo te permite añadir el doble de tu bonificador por competencia con una herramienta, puedes elegir dos objetos relacionados con esa herramienta en lugar de uno.

A continuación, elige una de las siguientes opciones para cada objeto:
• Si es una armadura o un escudo, se mejora con una recompensa. Al alcanzar el nivel 5, la criatura también obtiene un bonificador de +1 a la Clase de Armadura mientras lleve la armadura puesta o el escudo embrazado.
• Si es un arma, se mejora con una recompensa. Si consigues un éxito mágico con las herramientas utilizadas, el arma también puede volverse mágica. Al alcanzar el nivel 5, la criatura también obtiene un bonificador de +1 a las tiradas de ataque y daño realizadas con el arma.
• Si es cualquier otro objeto, elige una habilidad relacionada de algún modo, como por ejemplo Sigilo si el objeto es una capa, o Atletismo si se trata de un par de botas. Una criatura que tenga o lleve puesto el objeto obtiene un dado de bendición en las pruebas de característica que utilicen esa habilidad. Si consigues un éxito mágico con las herramientas utilizadas, el objeto puede convertirse en un artefacto maravilloso con una bendición que afecte a la habilidad elegida.

Las opciones anteriores solo se pueden elegir una vez para cada objeto, y no se puede recuperar un espacio de arte gastado de esta forma hasta la siguiente fase de comunidad, en la que se pueden retirar las bonificaciones otorgadas por este espacio y recuperarlo, si así se quiere."""
    },
    {
        "nombre": "Arte de la medicina",
        "descripcion_corta": "Eres hábil en la curación de heridas y enfermedades.",
        "descripcion": """Eres hábil, siguiendo antiguas tradiciones, en la curación de heridas y enfermedades. Como acción, puedes gastar un espacio de arte para atender a una criatura situada a 5 pies (1,5 m) o menos de ti y realizar una prueba de Inteligencia (Medicina) contra CD 10. Puedes gastar un uso de un equipo de sanador para reemplazar la tirada de d20 por un 10.

Si tienes éxito, la criatura recupera un número de puntos de golpe igual al resultado de tu prueba menos 10 (mínimo 1 punto de golpe).

Cuando alcanzas el nivel 5, superando una prueba puedes curar al objetivo de una enfermedad o neutralizar un veneno que le afecte."""
    },
    {
        "nombre": "Arte de la oratoria",
        "descripcion_corta": "Eres estudiante de sindarin y quenya, la Lengua Antigua, y eres muy capaz en las pruebas de Carisma.",
        "descripcion": """Eres estudiante de sindarin y quenya, la Lengua Antigua, y tienes ventaja en las pruebas de Carisma cuando interactúas con elfos. Además, como acción puedes usar un espacio de arte y elegir una criatura que no sea un elfo, un Mago o una criatura de poder similar, que esté situada a 30 pies (9 m) o menos de ti y que pueda oírte.

A continuación, elige una de las siguientes opciones:
• Lleva a cabo una prueba de Carisma (Intimidación) enfrentada a una prueba de Carisma (Intimidación) del objetivo. Un objetivo tiene ventaja en esta prueba si su tamaño es Grande o mayor, o si no puede entenderte. Si ganas el enfrentamiento, el objetivo está asustado de ti durante 1 minuto. El objetivo asustado puede realizar una prueba de Carisma (Intimidación) contra tu puntuación pasiva de Carisma (Intimidación) al final de cada uno de sus turnos, terminando el efecto sobre sí mismo si tiene éxito. Cuando alcances el nivel 5, puedes tener como objetivo una criatura adicional, o dos criaturas adicionales a nivel 9.

• Lleva a cabo una prueba de Carisma (Intimidación) o Carisma (Persuasión) enfrentada a una prueba de Sabiduría (Perspicacia) del objetivo. Un objetivo tiene ventaja en esta prueba si es inmune a ser hechizado o si no puede entenderte. Si ganas el enfrentamiento, puedes pronunciar una orden de una sola palabra que el objetivo debe obedecer en su siguiente turno, si puede y si la orden no le perjudica directamente. Cuando el objetivo ha ejecutado la orden, termina su turno. Algunas órdenes típicas son «¡Cáete!» (el objetivo cae derribado), «¡Huye!» (el objetivo se aleja de ti) y «¡Detente!» (el objetivo no se mueve y no realiza ninguna acción). El efecto puede considerarse una fechoría dependiendo de las circunstancias. Cuando alcanzas el nivel 5, puedes tener como objetivo una criatura adicional, o dos criaturas adicionales a nivel 9."""
    },
    {
        "nombre": "Arte de las runas",
        "descripcion_corta": "A partir de ahora eres capaz de leer y escribir inscripciones rúnicas. Puedes crear runas mágicas de salvación y perdición.",
        "descripcion": """A partir de ahora eres capaz de leer y escribir inscripciones rúnicas. Puedes usar las runas para transmitir mensajes secretos a otras criaturas que las conozcan o a las que hayas instruido previamente sobre su significado.

Al final de un descanso corto o largo, puedes usar un espacio de arte y elegir un objeto mágico en posesión de la compañía. Lleva a cabo una prueba de Inteligencia (Saber antiguo). La CD es 10 para un artefacto maravilloso, 15 para un objeto extraordinario o 20 para un arma o armadura famosa. Si tienes éxito, descubres todo lo que hay que saber sobre las cualidades del objeto y si está maldito o no.

Además, durante una fase de comunidad, puedes usar un espacio de arte para inscribir runas de poder en un objeto no mágico de tu elección, o en dos objetos cuando alcances el nivel 5. Debes tener competencia con las herramientas relacionadas con el material del que está hecho el objeto que elijas (herramientas de herrería para el metal, herramientas de tallar madera para la madera, etc.).

Mientras una criatura tenga o lleve puesto el objeto, obtiene un bonificador +1 a las tiradas de salvación. Si el objeto es un escudo o un arma, puedes atribuirle una perdición en su lugar: Elige un tipo de criatura entre hombres malignos, orcos, arañas, troles, muertos vivientes o lobos. Si el objeto tiene una o más recompensas, sus efectos se duplican contra criaturas sujetas a la perdición (por ejemplo, un arma Afilada obtiene un impacto crítico con una tirada de 18-20 contra criaturas sujetas a perdición).

Las runas solo pueden inscribirse una vez en cada objeto, y no puedes recuperar un espacio de arte usado de esta manera hasta la siguiente fase de comunidad, momento en el que puedes cancelar las runas inscritas con ese espacio y recuperarlo, si quieres."""
    },
    {
        "nombre": "Arte de los bosques",
        "descripcion_corta": "Estás familiarizado con las dificultades que surgen al atravesar tierras salvajes y con las formas de superarlas.",
        "descripcion": """Estás familiarizado con las dificultades que surgen al atravesar tierras salvajes y con las formas de superarlas. Puedes hacer una prueba de Inteligencia (Naturaleza) en lugar de cualquier prueba de Sabiduría (Explorar) o Sabiduría (Cazar).

Además, puedes gastar 1 hora y un espacio de arte para realizar una prueba de Inteligencia (Naturaleza), Sabiduría (Explorar) o Sabiduría (Cazar) (a elegir). La CD está determinada por el tipo de terreno que la compañía está atravesando en este momento. La prueba tiene desventaja si es otoño o invierno. Si tienes éxito, elige una de las siguientes opciones:

• Elige un número de criaturas igual al resultado de tu prueba menos la CD del terreno (mínimo 1), entre las que puedes incluirte. Durante 1 hora, cada una de dichas criaturas tiene un bonificador +5 a las pruebas de Destreza (Sigilo). Cuando alcanzas el nivel 5, el bonificador aumenta a +10. Si obtienes un éxito mágico, las criaturas tampoco dejan huellas ni ningún otro rastro de su paso mientras dura el efecto.

• Elige un número de criaturas igual al resultado de tu prueba menos la CD del terreno (mínimo 1), entre las que puedes incluirte. Durante 8 horas, cada una de dichas criaturas tiene un bonificador +5 a su puntuación pasiva de Sabiduría (Percepción). Al alcanzar el nivel 5, el bonificador aumenta a +10. Si obtienes un éxito mágico, las criaturas también obtienen sentir vibraciones hasta un alcance de 60 pies mientras dura el efecto.

• Consigues un número de libras de comida y galones de agua igual al resultado de tu prueba menos la CD del terreno (mínimo 1). La comida dura 24 horas, o 48 horas cuando alcanzas el nivel 5. Si obtienes un éxito mágico, cada libra de comida forrajeada de esta forma también restaura 1 punto de golpe a la criatura que la come durante un descanso corto o largo."""
    },
    {
        "nombre": "Arte de las armas",
        "descripcion_corta": "Obtienes competencia y mejoras de ataque en un tipo de armas.",
        "descripcion": """Elige un tipo de arma. Obtienes competencia con esta arma si aún no la tienes.

Cuando atacas con ese tipo de arma y se trata de un arma sutil o a distancia, puedes utilizar tu modificador por Inteligencia, Sabiduría o Carisma en lugar de tu modificador por Fuerza o Destreza para las tiradas de ataque y daño. Debes utilizar el mismo modificador para ambas tiradas.

Además, cuando aciertas a una criatura con el arma elegida, puedes usar un espacio de arte para lanzar un número de dados de daño de arma adicionales en la tirada de daño. El número de dados de daño de arma adicionales es igual a tu bonificador por competencia."""
    },
    {
        "nombre": "Arte de las bestias",
        "descripcion_corta": "Obtienes la aptitud de comprender y comunicarte verbalmente con las bestias.",
        "descripcion": """Obtienes la aptitud de comprender y comunicarte verbalmente con las bestias. El conocimiento y la conciencia de muchas bestias están limitados por su inteligencia, pero en general pueden darte información sobre lugares y criaturas cercanos, incluyendo cualquier cosa que puedan percibir o hayan percibido en el último día. Podrías persuadir a una bestia para que te haga un pequeño favor, a discreción del Maestro del saber, como entregar una carta o un mensaje verbal a alguien que también pueda hablar con las bestias.

Además, como acción puedes usar un espacio de arte y elegir una bestia a la que puedas ver y que esté a 30 pies (9 m) o menos de ti. Debe ser capaz de verte y oírte. Realiza una prueba de Sabiduría (Trato con animales), enfrentada a una prueba de Sabiduría (Perspicacia) del objetivo.

Si ganas el enfrentamiento, la bestia queda hechizada por ti durante 24 horas o hasta que tú o tus compañeros le causéis algún daño.

Si obtienes un éxito mágico y el objetivo es una bestia con un valor de desafío de 1/8 o inferior, puedes hacer que la bestia quede permanentemente hechizada por ti, hasta que la liberes, le causes daño o hagas que otra bestia quede permanentemente hechizada por ti.

Una bestia gana automáticamente la prueba si su puntuación de Inteligencia es 4 o superior.

A nivel 5, puedes afectar a una bestia adicional, o a dos bestias adicionales a nivel 9."""
    },
    {
        "nombre": "Arte de las canciones",
        "descripcion_corta": "Has sido entrenado en el canto según la tradición de los juglares errantes.",
        "descripcion": """Has sido entrenado en el canto según la tradición de los juglares errantes. Tu sabiduría musical es más profunda que la de la mayoría, ya que participas de los conocimientos de los grandes cantantes de antaño.

Como acción, puedes gastar un espacio de arte y realizar una prueba de Carisma (Interpretación), enfrentada a una prueba de Inteligencia (Acertijos) de todas las criaturas a tu elección situadas a 30 pies (9 m) o menos de ti y que puedan oírte. Una criatura puede elegir fallar su prueba de característica si lo desea.

Por cada objetivo contra el que ganes el enfrentamiento, elige una de las siguientes opciones:
• Puedes suprimir cualquier efecto que cause que el objetivo esté hechizado o asustado hasta el final de tu siguiente turno. Este efecto termina si el objetivo deja de oírte.
• Puedes hacer que el objetivo que es hostil se vuelva indiferente hacia las criaturas de tu elección hasta el final de tu siguiente turno. El objetivo también tiene desventaja en las pruebas de Sabiduría (Percepción) realizadas para percibir a cualquier criatura que no seas tú durante el mismo tiempo. Este efecto termina si el objetivo deja de oírte, si resulta herido o si presencia cómo se causa daño a alguno de sus amigos.
• Hasta el final de tu siguiente turno, siempre que el objetivo realice una tirada de ataque o una tirada de salvación, debe tirar un d4 y sumar el número obtenido a la tirada de ataque o a la tirada de salvación (si el objetivo es amistoso hacia ti), o restarlo (si el objetivo es hostil). Este efecto termina si el objetivo deja de oírte.

Cuando alcanzas el nivel 5, puedes utilizar una acción adicional en cada uno de tus turnos para ampliar la duración de uno de estos efectos en todos los objetivos hasta el final de tu siguiente turno, hasta un máximo de 1 minuto."""
    }
]

# RECOMPENSAS - Completas con bendiciones
RECOMPENSAS_DATA = {
    "mejoras": [
        {"tipo": "Arma C/C", "nombre": "Afilada", "efecto": "Impacta con crítico con 19–20", "restriccion": "No acumulable con otras mejoras de crítico"},
        {"tipo": "Arma C/C", "nombre": "Cruel", "efecto": "En crítico, añade +2 dados del daño del arma", "restriccion": "No aplicable a armas con munición"},
        {"tipo": "Arma C/C", "nombre": "Dolorosa", "efecto": "+1 al daño del arma", "restriccion": "Solo una vez por arma"},
        {"tipo": "Armadura", "nombre": "Ajustada", "efecto": "Los críticos contra el portador se convierten en impactos normales", "restriccion": "Solo una vez por armadura"},
        {"tipo": "Armadura", "nombre": "Hábilmente fabricada", "efecto": "Peso reducido a la mitad; +1 al máximo de DEX aplicable a la CA", "restriccion": "No acumulable con otras reducciones de peso"},
        {"tipo": "Escudo", "nombre": "Reforzado", "efecto": "+1 adicional a la CA", "restriccion": "Se acumula con el bono normal del escudo"}
    ],
    "niveles_recompensa": [
        {"nivel": 3, "recompensas": 1},
        {"nivel": 5, "recompensas": 1},
        {"nivel": 7, "recompensas": 1},
        {"nivel": 9, "recompensas": 1}
    ],
    "bendiciones": {
        "descripcion": "Los objetos que se envuelven con poderosos encantamientos (llamados bendiciones, mejoras a las habilidades del personaje que lleva el objeto en cuestión). Un objeto que tiene una bendición se llama artefacto maravilloso. Las bendiciones pueden otorgarse mediante el Arte de la fabricación o pueden encontrarse en tesoros antiguos. Un artefacto maravilloso solo puede tener una bendición activa a la vez.",
        "bonificador_competencia": {
            "descripcion": "Según el nivel del personaje que imparte la bendición al objeto, se tirará un dado y el resultado será el modificador a dicha bendición.",
            "tabla": [
                {"nivel": "1-4", "dado": "1d4"},
                {"nivel": "5-8", "dado": "1d6"},
                {"nivel": "9-12", "dado": "1d8"},
                {"nivel": "13-16", "dado": "1d10"},
                {"nivel": "17-20", "dado": "1d12"}
            ]
        }
    }
}

# SALARIOS
SALARIOS_DATA = {
    "descripcion": "Salarios Mensuales en la Tierra Media. Los valores son aproximados y dependen de la región y el empleador (Gondor, Rohan, La Comarca, etc.). Valores medidos en monedas de cobre.",
    "nota": "La base del salario se calcula según la básica del campesino.",
    "categorias": {
        "trabajadores_no_cualificados": [
            {"ocupacion": "Campesino", "modificador": 1.0, "salario_bajo": 80, "salario_medio": 120, "salario_alto": 160, "diario": 4, "notas": "Cultivan cereales, verduras y frutas."},
            {"ocupacion": "Leñador", "modificador": 1.1, "salario_bajo": 88, "salario_medio": 132, "salario_alto": 176, "diario": 4.4, "notas": "Cortan madera para hogares y herreros."},
            {"ocupacion": "Peón de construcción", "modificador": 1.25, "salario_bajo": 100, "salario_medio": 150, "salario_alto": 200, "diario": 5, "notas": "Construyen casas, murallas y puentes."},
            {"ocupacion": "Mozo de cuadra", "modificador": 1.15, "salario_bajo": 92, "salario_medio": 138, "salario_alto": 184, "diario": 4.6, "notas": "Cuida caballos y monturas."},
            {"ocupacion": "Criado / Sirviente", "modificador": 1.3, "salario_bajo": 104, "salario_medio": 156, "salario_alto": 208, "diario": 5.2, "notas": "En casas nobles, fortalezas y posadas. Incluye cama y comida."},
            {"ocupacion": "Cazador", "modificador": 1.4, "salario_bajo": 112, "salario_medio": 168, "salario_alto": 224, "diario": 5.6, "notas": "Provee carne y pieles."},
            {"ocupacion": "Herrero aprendiz", "modificador": 1.3, "salario_bajo": 104, "salario_medio": 156, "salario_alto": 208, "diario": 5.2, "notas": "Forja herramientas básicas. Incluye comida y aprendizaje."},
            {"ocupacion": "Barquero / Remero", "modificador": 1.2, "salario_bajo": 96, "salario_medio": 144, "salario_alto": 192, "diario": 4.8, "notas": "Transporta personas y mercancías."},
            {"ocupacion": "Mendigo", "modificador": 0.2, "salario_bajo": 16, "salario_medio": 24, "salario_alto": 32, "diario": 0.8, "notas": "Depende de la generosidad ajena."}
        ],
        "trabajadores_cualificados": [
            {"ocupacion": "Herrero", "modificador": 2.5, "salario_bajo": 200, "salario_medio": 300, "salario_alto": 400, "diario": 10, "notas": "Armas, armaduras y herramientas."},
            {"ocupacion": "Carpintero", "modificador": 2.0, "salario_bajo": 160, "salario_medio": 240, "salario_alto": 320, "diario": 8, "notas": "Construcción y muebles."},
            {"ocupacion": "Albañil", "modificador": 2.1, "salario_bajo": 168, "salario_medio": 252, "salario_alto": 336, "diario": 8.4, "notas": "Trabaja en castillos y murallas."},
            {"ocupacion": "Mercader", "modificador": 3.0, "salario_bajo": 240, "salario_medio": 360, "salario_alto": 480, "diario": 12, "notas": "Negocia bienes y especias."},
            {"ocupacion": "Posadero", "modificador": 2.2, "salario_bajo": 176, "salario_medio": 264, "salario_alto": 352, "diario": 8.8, "notas": "Depende de la clientela."},
            {"ocupacion": "Explorador / Rastreador", "modificador": 2.4, "salario_bajo": 192, "salario_medio": 288, "salario_alto": 384, "diario": 9.6, "notas": "Guía por tierras salvajes."},
            {"ocupacion": "Músico / Juglar", "modificador": 1.8, "salario_bajo": 144, "salario_medio": 216, "salario_alto": 288, "diario": 7.2, "notas": "Puede recibir propinas."},
            {"ocupacion": "Sanador / Herbalista", "modificador": 2.7, "salario_bajo": 216, "salario_medio": 324, "salario_alto": 432, "diario": 10.8, "notas": "Usa hierbas y ungüentos."},
            {"ocupacion": "Arquero de élite", "modificador": 3.5, "salario_bajo": 280, "salario_medio": 420, "salario_alto": 560, "diario": 14, "notas": "En Gondor o Lothlórien."},
            {"ocupacion": "Maestro de escuela", "modificador": 2.8, "salario_bajo": 224, "salario_medio": 336, "salario_alto": 448, "diario": 11.2, "notas": "En ciudades y cortes nobles."}
        ],
        "nobles_y_guerreros": [
            {"ocupacion": "Capitán de la guardia", "modificador": 3.2, "salario_bajo": 256, "salario_medio": 384, "salario_alto": 512, "diario": 12.8, "notas": "Defiende fortalezas y ciudades."},
            {"ocupacion": "Caballero de Gondor", "modificador": 7.0, "salario_bajo": 560, "salario_medio": 840, "salario_alto": 1120, "diario": 28, "notas": "Sirve a reyes y señores."},
            {"ocupacion": "Mercenario", "modificador": 3.0, "salario_bajo": 240, "salario_medio": 360, "salario_alto": 480, "diario": 12, "notas": "Depende del contrato."},
            {"ocupacion": "Señor de una aldea", "modificador": 9.0, "salario_bajo": 720, "salario_medio": 1080, "salario_alto": 1440, "diario": 36, "notas": "Recauda impuestos y protege la aldea."},
            {"ocupacion": "Príncipe o noble", "modificador": 31.0, "salario_bajo": 2480, "salario_medio": 3720, "salario_alto": 4960, "diario": 124, "notas": "Depende del reino y su influencia."}
        ],
        "razas_especiales": [
            {"ocupacion": "Enano Herrero", "modificador": 4.0, "salario_bajo": 320, "salario_medio": 480, "salario_alto": 640, "diario": 16, "notas": "Creadores de armas legendarias."},
            {"ocupacion": "Elfo Artesano", "modificador": 4.5, "salario_bajo": 360, "salario_medio": 540, "salario_alto": 720, "diario": 18, "notas": "Tallado de madera, joyería y espadas."},
            {"ocupacion": "Mago Errante", "modificador": 11.0, "salario_bajo": 880, "salario_medio": 1320, "salario_alto": 1760, "diario": 44, "notas": "Contratados por nobles y reyes."},
            {"ocupacion": "Hobbit Posadero", "modificador": 2.4, "salario_bajo": 192, "salario_medio": 288, "salario_alto": 384, "diario": 9.6, "notas": "Como el Sr. Mantecona en Bree."}
        ]
    },
    "modificadores": {
        "por_region": [
            {"region": "La Comarca", "modificador": -0.15, "notas": "Vida sencilla; muchos trabajos incluyen comida"},
            {"region": "Bree y tierras cercanas", "modificador": 0, "notas": "Mano de obra estable"},
            {"region": "Arnor en ruinas", "modificador": 0.1, "notas": "Pocos trabajadores, inseguridad"},
            {"region": "Rohan", "modificador": -0.05, "notas": "Trabajo físico común; soldados escasos"},
            {"region": "Gondor (zonas rurales)", "modificador": 0, "notas": "Sistema estable"},
            {"region": "Minas Tirith", "modificador": 0.25, "notas": "Coste de vida alto"},
            {"region": "Pelargir / Puertos", "modificador": 0.15, "notas": "Oficios especializados"},
            {"region": "Ithilien en paz", "modificador": -0.05, "notas": "Abundancia, veteranos asentados"},
            {"region": "Ithilien en guerra", "modificador": 0.3, "notas": "Riesgo real"},
            {"region": "Tierras del Norte salvajes", "modificador": 0.2, "notas": "Difícil atraer PNJ"},
            {"region": "Moria / zonas enanas activas", "modificador": 0.2, "notas": "Alta cualificación"},
            {"region": "Lórien / Rivendel", "modificador": 0.4, "notas": "No asalariados"},
            {"region": "Tierras bajo sombra", "modificador": 0.5, "notas": "Solo desesperados"},
            {"region": "Mordor", "modificador": 1.0, "notas": "Esclavitud o fanáticos"}
        ],
        "por_asentamiento": [
            {"tipo": "Granja aislada", "modificador": -0.10, "notas": "Trato personal"},
            {"tipo": "Aldea pequeña", "modificador": -0.05, "notas": "Mano de obra local"},
            {"tipo": "Villa / Pueblo", "modificador": 0, "notas": "Mercado laboral básico"},
            {"tipo": "Ciudad media", "modificador": 0.10, "notas": "Más opciones"},
            {"tipo": "Capital / Gran ciudad", "modificador": 0.25, "notas": "Coste de vida"},
            {"tipo": "Fuerte militar", "modificador": 0.30, "notas": "Riesgo y disciplina"},
            {"tipo": "Puerto comercial", "modificador": 0.15, "notas": "Oficios técnicos"},
            {"tipo": "Asentamiento fronterizo", "modificador": 0.35, "notas": "Peligro"},
            {"tipo": "Campamento temporal", "modificador": 0.40, "notas": "Incomodidad"},
            {"tipo": "Ruinas habitadas", "modificador": 0.60, "notas": "Muy pocos aceptan"}
        ],
        "por_relacion": [
            {"relacion": "Hostil", "modificador": 0.50, "notas": "O se niegan"},
            {"relacion": "Desconfiado", "modificador": 0.25, "notas": "Exigen garantías"},
            {"relacion": "Neutral", "modificador": 0, "notas": "Salario justo"},
            {"relacion": "Correcto", "modificador": -0.05, "notas": "Trato profesional"},
            {"relacion": "Amigable", "modificador": -0.10, "notas": "Confianza"},
            {"relacion": "Aliado", "modificador": -0.20, "notas": "Lealtad"},
            {"relacion": "Protegido / Favor", "modificador": -0.30, "notas": "Servicio personal"},
            {"relacion": "Juramento / Lealtad", "modificador": -0.50, "notas": "Vínculo feudal"}
        ],
        "por_contexto": [
            {"situacion": "Paz prolongada", "modificador": -0.10, "notas": "Mano de obra abundante"},
            {"situacion": "Rumores de guerra", "modificador": 0.15, "notas": "Incertidumbre"},
            {"situacion": "Guerra abierta", "modificador": 0.40, "notas": "Escasez"},
            {"situacion": "Asedio", "modificador": 0.80, "notas": "Supervivencia"},
            {"situacion": "Posguerra inmediata", "modificador": 0.25, "notas": "Reconstrucción"},
            {"situacion": "Año de malas cosechas", "modificador": 0.30, "notas": "Hambre"},
            {"situacion": "Invierno duro", "modificador": 0.20, "notas": "Riesgo"},
            {"situacion": "Ruta comercial cortada", "modificador": 0.35, "notas": "Aislamiento"}
        ]
    }
}

# VARIOS - Pruebas de habilidad, cansancio, inspiración, ojo de mordor, ventaja
VARIOS_DATA = {
    "pruebas_habilidad": {
        "descripcion": "Las pruebas de habilidad se realizan con 1d20 + modificador de característica + bonificador por competencia (si aplica).",
        "habilidades_por_caracteristica": {
            "FUERZA": ["Atletismo (Fue)"],
            "DESTREZA": ["Acrobacias (Des)", "Juego de manos (Des)", "Sigilo (Des)"],
            "INTELIGENCIA": ["Acertijos (Int)", "Investigación (Int)", "Medicina (Int)", "Naturaleza (Int)", "Saber antiguo (Int)"],
            "SABIDURIA": ["Cazar (Sab)", "Explorar (Sab)", "Percepción (Sab)", "Perspicacia (Sab)", "Trato con animales (Sab)", "Viajar (Sab)"],
            "CARISMA": ["Engaño (Car)", "Interpretación (Car)", "Intimidación (Car)", "Persuasión (Car)"]
        },
        "dificultad": [
            {"nombre": "Muy fácil", "cd": 5, "descripcion": "Se trata de acciones que la mayoría de aventureros pueden llevar a cabo sin esfuerzo, y que en la mayoría de los casos no deberían requerir una tirada. Ejemplos incluyen influenciar a un individuo de voluntad débil intoxicado por la bebida, deducir las intenciones de una persona muy obvia, etc."},
            {"nombre": "Fácil", "cd": 10, "descripcion": "Estas son acciones que requieren cierta familiaridad con un campo específico. Son acciones como esconder un pequeño objeto entre los pliegues de un manto sin que nadie se dé cuenta, etc."},
            {"nombre": "Normal", "cd": 14, "descripcion": "El nivel de dificultad por defecto de la mayoría de las acciones, este NO refleja una situación en la que un aventurero competente tiene una posibilidad razonable de éxito."},
            {"nombre": "Moderada", "cd": 16, "descripcion": "Divisar una trampa bien escondida, impresionar a un miliciano local, obtener información de un extraño receloso."},
            {"nombre": "Difícil", "cd": 18, "descripcion": "Acciones que requieren habilidad excepcional o condiciones desfavorables."},
            {"nombre": "Muy Difícil", "cd": 20, "descripcion": "Acciones que desafían incluso a los más hábiles."},
            {"nombre": "Casi imposible", "cd": 25, "descripcion": "Hazañas que rozan lo sobrehumano."},
            {"nombre": "Heroica", "cd": 30, "descripcion": "Solo los legendarios héroes de antaño podrían lograr esto."}
        ],
        "nota_elevacion": "Por ejemplo, cuando hay que elevar en un nivel un NO moderado, se convierte en un NO difícil. Los seis niveles de dificultad no deberían verse como un esquema rígido, para memorizar y aplicar rígidamente."
    },
    "cansancio": {
        "descripcion": "El cansancio representa el agotamiento físico y mental de una criatura.",
        "niveles": [
            {"nivel": 1, "consecuencia": "Desventaja en las pruebas de característica"},
            {"nivel": 2, "consecuencia": "Velocidad reducida a la mitad"},
            {"nivel": 3, "consecuencia": "Desventaja en tiradas de ataque y de salvación"},
            {"nivel": 4, "consecuencia": "Puntos de golpe máximos reducidos a la mitad"},
            {"nivel": 5, "consecuencia": "Velocidad reducida a 0"},
            {"nivel": 6, "consecuencia": "Muerte"}
        ],
        "reglas": [
            {"regla": "Acumulación", "efecto": "Si una criatura gana más cansancio, su nivel aumenta en la cantidad indicada."},
            {"regla": "Efectos acumulativos", "efecto": "Se aplican todas las consecuencias del nivel actual y de los inferiores."},
            {"regla": "Recuperación parcial", "efecto": "Un descanso largo reduce el cansancio en 1 nivel si la criatura ha comido y bebido."},
            {"regla": "Recuperación total", "efecto": "Si el nivel baja por debajo de 1, desaparecen todas las consecuencias."}
        ]
    },
    "inspiracion": {
        "descripcion": "La Inspiración es una regla opcional que el Dungeon Master (DM) puede usar para recompensar a los jugadores por interpretar a sus personajes de manera fiel y creativa, basándose en sus rasgos de personalidad, ideales, vínculos y defectos.",
        "como_obtener": [
            "Interpretes tus rasgos de personalidad de forma interesante o fiel.",
            "Te pongas en una situación desfavorable debido a tu defecto o vínculo.",
            "Hagas algo que enriquezca la historia o la partida."
        ],
        "nota_acumulacion": "Solo puedes tener una Inspiración a la vez. No se acumula.",
        "como_usar": [
            "Puedes gastar tu Inspiración para obtener ventaja en una tirada de: Ataque, Salvación o Prueba de característica.",
            "También puedes dar tu Inspiración a otro jugador si consideras que hizo algo destacable, como una buena interpretación, una idea creativa o inteligente, o un acto que haga la partida más divertida o interesante."
        ]
    },
    "ojo_de_mordor": {
        "descripcion": "El Ojo de Mordor representa la atención que el Enemigo presta a la compañía de aventureros.",
        "puntuacion_inicial": [
            {"condicion": "Solo hobbits u hombres", "puntos": 0},
            {"condicion": "Uno o más enanos", "puntos": 1},
            {"condicion": "Uno o más dúnedain o elfos", "puntos": 2},
            {"condicion": "Uno o más altos elfos", "puntos": 3},
            {"condicion": "Cada PJ con nivel 5 o más", "puntos": 1},
            {"condicion": "Cada arma famosa o poderosa", "puntos": 2}
        ],
        "durante_juego": [
            {"evento": "Sacar 1 en las tiradas 1d20", "puntos": 1},
            {"evento": "Aumento de puntos de sombra", "puntos": "= puntos ganados"},
            {"evento": "Magia con efecto menor", "puntos": 1},
            {"evento": "Conjuros mayores", "puntos": 2},
            {"evento": "Conjuros poderosos", "puntos": 3}
        ],
        "episodios_revelacion": "Lo que le ocurre a la compañía debe surgir de forma natural durante la sesión, y un episodio de revelación ha de sugerir fuerzas extrañas: un aura oscura y corrupta, una desventura maliciosa, comportamientos sospechosos. Un episodio de revelación típico puede implicar que un héroe se separe del grupo, que las provisiones se estropeen y falte comida, que una decisión resulte desastrosa o que una ayuda esperada no llegue.",
        "volver_nivel_inicial": "Tras resolverse el episodio de revelación, la compañía vuelve a considerarse oculta y la puntuación de Atención del Ojo regresa a su nivel inicial. Cuando termina una fase de aventuras, el cálculo de la Atención del Ojo se interrumpe durante la fase de comunidad.",
        "la_caza": {
            "descripcion": "La Caza representa la búsqueda activa del Enemigo.",
            "regiones": [
                {"region": "Tierra fronteriza", "umbral": 18},
                {"region": "Tierra salvaje", "umbral": 16},
                {"region": "Tierra oscura", "umbral": 14}
            ],
            "modificadores": [
                {"descripcion": "La compañía se encuentra bajo la protección de un Mago u otro personaje poderoso", "modificador": "+4"},
                {"descripcion": "La compañía viaja usando nombres falsos y rutas poco frecuentadas", "modificador": "+2"},
                {"descripcion": "Los héroes se han labrado un nombre en la zona gracias a una hazaña excepcional", "modificador": "-2"},
                {"descripcion": "El Enemigo busca activamente a los compañeros o conoce su misión", "modificador": "-4"}
            ]
        }
    },
    "ventaja": {
        "descripcion": "La ventaja y la desventaja modifican las tiradas de dados.",
        "reglas": [
            {"tipo": "Ventaja", "efecto": "Añade +5 a la tirada"},
            {"tipo": "Desventaja", "efecto": "Resta -5 a la tirada"}
        ],
        "nota": "Si tienes tanto ventaja como desventaja, se cancelan mutuamente."
    },
    "mas_alla_nivel_10": {
        "descripcion": "Los niveles de los personajes (en cuanto a puntos de golpe, competencia y demás) no va a subir del nivel 10. Ya no hay héroes como los de antaño…"
    }
}

# COMBATE
COMBATE_DATA = {
    "estructura": {
        "descripcion": "Estructura de un combate en ESDLA 5e",
        "fases": [
            {"fase": "1. Posiciones", "descripcion": "Hay que poner las posiciones de cada combatiente."},
            {"fase": "2. Sorpresa", "descripcion": "Se determina si algún bando debe estar sorprendido. Si hay que calcularlo, tirada de destreza en sigilo para ocultarte, tirada de percepción sabiduría para detectar. Quien esté sorprendido no puede actuar en ese turno."},
            {"fase": "3. Iniciativa", "descripcion": "Todos los involucrados hacen una tirada de iniciativa, prueba de destreza. Se pone el orden de tirada de todos los involucrados."},
            {"fase": "4. Turnos", "descripcion": "Cada combatiente actúa en orden de iniciativa."}
        ]
    },
    "acciones": {
        "descripcion": "Acciones disponibles en un turno de combate",
        "lista": [
            {"accion": "Moverte", "descripcion": "Máximo tu velocidad de desplazamiento."},
            {"accion": "Atacar", "descripcion": "Realizar un ataque contra un objetivo."},
            {"accion": "Correr", "descripcion": "Duplicar tu movimiento por este turno."},
            {"accion": "Destrabarse", "descripcion": "Tu movimiento no provoca ataques de oportunidad."},
            {"accion": "Esquivar", "descripcion": "Los ataques contra ti tienen desventaja."},
            {"accion": "Ayudar", "descripcion": "Dar ventaja a un aliado en su siguiente prueba o ataque."},
            {"accion": "Esconderse", "descripcion": "Realizar una prueba de Sigilo para ocultarse."},
            {"accion": "Preparar una acción", "descripcion": "Preparar una acción para ejecutar cuando se cumpla una condición."},
            {"accion": "Buscar", "descripcion": "Realizar una prueba de Percepción o Investigación."},
            {"accion": "Usar un objeto", "descripcion": "Interactuar con un objeto del entorno o inventario."}
        ]
    },
    "atacar": {
        "descripcion": "Procedimiento para realizar un ataque",
        "pasos": [
            {"paso": "1. Escoge objetivo", "descripcion": "Elige una criatura u objeto a atacar."},
            {"paso": "2. Cobertura", "descripcion": "Determina si el objetivo tiene cobertura: media (+2 CA), 3/4 (+5 CA)."},
            {"paso": "3. Ventaja/Desventaja", "descripcion": "Determina si tienes ventaja (+5) o desventaja (-5)."},
            {"paso": "4. Tirada de ataque", "descripcion": "1d20 + modificador por característica (Fuerza o Destreza) + bonificador por competencia."},
            {"paso": "5. Comparar con CA", "descripcion": "Si el total iguala o supera la Clase de Armadura, impactas."}
        ],
        "criticos": [
            {"tirada": 20, "efecto": "Siempre impacta. Crítico: tira los dados de daño 2 veces."},
            {"tirada": 1, "efecto": "Nunca impacta, pifia."}
        ]
    },
    "muerte_e_inconsciencia": {
        "muerte": "Si te hacen daño y el resultado en negativo de tus puntos de golpe es mayor que tus puntos de golpe totales, mueres.",
        "inconsciencia": "Si tus puntos de golpe caen a 0 o menos pero no superan en negativo tus puntos de golpe totales, quedas inconsciente.",
        "tiradas_salvacion_muerte": {
            "descripcion": "Cada turno tiras un 1d20.",
            "reglas": [
                {"resultado": "10 o más", "efecto": "Éxito. Con tres éxitos (consecutivos o no) recuperas 1 PG y te recuperas."},
                {"resultado": "20", "efecto": "Recuperas 1 PG de golpe y te despiertas."},
                {"resultado": "9 o menos", "efecto": "Fracaso. Con tres fracasos (consecutivos o no) mueres."},
                {"resultado": "1", "efecto": "Cuenta como 2 fracasos."},
                {"resultado": "Recibir daño", "efecto": "Cuenta como un fracaso. Si superan en negativo tus PG totales, mueres."}
            ]
        },
        "estabilizar": "Prueba de Medicina CD10 para estabilizar al inconsciente. Si no se le hace nada, al cabo de 4 horas recibe 1 PG. Si se le hace daño, empiezan de nuevo las tiradas de salvación de la muerte.",
        "nota_enemigos": "Los enemigos en general, si llegan a 0 PG mueren. Se puede mantener vivos a PNJ o enemigos importantes que se necesiten."
    }
}

async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Update ARTES
    print("Actualizando Artes...")
    await db.artes.delete_many({})
    await db.artes.insert_many(ARTES_DATA)
    print(f"  Insertadas {len(ARTES_DATA)} artes")
    
    # Update RECOMPENSAS
    print("Actualizando Recompensas...")
    await db.recompensas.delete_many({})
    await db.recompensas.insert_one({"_id": "main", **RECOMPENSAS_DATA})
    print("  Recompensas actualizadas")
    
    # Create SALARIOS
    print("Creando Salarios...")
    await db.salarios.delete_many({})
    await db.salarios.insert_one({"_id": "main", **SALARIOS_DATA})
    print("  Salarios creados")
    
    # Create VARIOS (multiple rules)
    print("Creando reglas Varios...")
    await db.varios_rules.delete_many({})
    await db.varios_rules.insert_one({"_id": "main", **VARIOS_DATA})
    print("  Reglas Varios creadas")
    
    # Create COMBATE
    print("Creando reglas de Combate...")
    await db.combate_rules.delete_many({})
    await db.combate_rules.insert_one({"_id": "main", **COMBATE_DATA})
    print("  Reglas de Combate creadas")
    
    print("\n✅ Todos los datos actualizados correctamente!")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
EOF
